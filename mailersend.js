// 群发邮件的主逻辑
async function handleRequest(request, env) {
    // 初始化统计数据
    const stats = {
        total: 0,
        success: 0,
        failed: 0,
        errors: [],
        startTime: new Date(),
        endTime: null
    };

    try {
        // 访问控制
        if (request.method === 'GET') {
            const url = new URL(request.url);
            const token = url.searchParams.get('token');
            if (!token || token !== env.ACCESS_TOKEN) {
                return new Response('未授权访问', { status: 401 });
            }
        }

        // 验证必要的环境变量
        const requiredVars = ['RESEND_API_KEY', 'FROM_EMAIL', 'TO_EMAILS', 'TG_TOKEN', 'TG_ID'];
        for (const varName of requiredVars) {
            if (!env[varName]) {
                throw new Error(`环境变量 ${varName} 未设置`);
            }
        }

        const resendApiKey = env.RESEND_API_KEY;
        const fromEmail = env.FROM_EMAIL;
        const subject = env.SUBJECT || "邮件测试";
        const body = env.BODY || "这是一封来自自动化脚本的邮件";
        const tgToken = env.TG_TOKEN;
        const tgId = env.TG_ID;

        // 验证邮件内容
        validateEmailContent(subject, body);

        // 解析并验证收件人邮箱
        const toEmails = (env.TO_EMAILS || "").split('\n')
            .map(email => email.trim())
            .filter(email => email && isValidEmail(email));

        if (toEmails.length === 0) {
            throw new Error("没有有效的收件人邮箱地址");
        }

        stats.total = toEmails.length;

        // 批量发送邮件
        const BATCH_SIZE = 50; // 每批发送邮件数量
        const DELAY_MS = 1000; // 批次间延迟时间

        for (let i = 0; i < toEmails.length; i += BATCH_SIZE) {
            const batch = toEmails.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(
                batch.map(async (email) => {
                    try {
                        const success = await sendEmail(email, resendApiKey, fromEmail, subject, body, tgToken, tgId);
                        if (success) {
                            stats.success++;
                        } else {
                            stats.failed++;
                        }
                        return { email, success };
                    } catch (error) {
                        stats.failed++;
                        stats.errors.push(`${email}: ${error.message}`);
                        return { email, success: false };
                    }
                })
            );

            if (i + BATCH_SIZE < toEmails.length) {
                await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }
        }

        // 生成最终报告
        stats.endTime = new Date();
        const duration = (stats.endTime - stats.startTime) / 1000;
        const report = `
📊 邮件发送报告
总数: ${stats.total}
成功: ${stats.success}
失败: ${stats.failed}
用时: ${duration}秒
${stats.errors.length > 0 ? '\n❌ 错误:\n' + stats.errors.join('\n') : ''}
        `;

        await sendTelegramNotification(report, tgToken, tgId);
        return new Response(report, { status: 200 });

    } catch (error) {
        const errorMessage = `系统错误: ${error.message}`;
        console.error(errorMessage);
        
        if (env.TG_TOKEN && env.TG_ID) {
            await sendTelegramNotification(errorMessage, env.TG_TOKEN, env.TG_ID);
        }
        
        return new Response(errorMessage, { status: 500 });
    }
}

// 发送邮件的函数（带重试机制）
async function sendEmail(toEmail, resendApiKey, fromEmail, subject, body, tgToken, tgId) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: fromEmail,
                    to: toEmail,
                    subject: subject,
                    text: body,
                }),
            });

            const responseData = await response.json();
            
            if (!response.ok) {
                throw new Error(`Resend API 错误: ${responseData.message || response.statusText}`);
            }

            await sendTelegramNotification(`✅ 邮件已成功发送到 **${toEmail}**`, tgToken, tgId);
            return true;

        } catch (error) {
            if (attempt === MAX_RETRIES) {
                const errorMessage = `发送邮件到 ${toEmail} 失败: ${error.message}`;
                console.error(errorMessage);
                await sendTelegramNotification(`❌ ${errorMessage}`, tgToken, tgId);
                return false;
            }
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            console.log(`重试第 ${attempt} 次发送到 ${toEmail}`);
        }
    }
}

// 发送 Telegram 通知的函数
async function sendTelegramNotification(message, tgToken, tgId) {
    if (!tgToken || !tgId) {
        console.log('Telegram 配置未完成，跳过通知');
        return;
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: tgId,
                text: message,
                parse_mode: 'Markdown'
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Telegram API 错误: ${error}`);
        }
    } catch (error) {
        console.error('发送 Telegram 通知失败:', error.message);
    }
}

// 辅助函数：验证邮件内容
function validateEmailContent(subject, body) {
    if (!subject || subject.trim().length === 0) {
        throw new Error('邮件主题不能为空');
    }
    if (!body || body.trim().length === 0) {
        throw new Error('邮件内容不能为空');
    }
    if (body.length > 100000) {
        throw new Error('邮件内容过长');
    }
}

// 辅助函数：验证邮箱格式
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// HTTP 触发器
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request, event.env));
});

// 定时触发器
addEventListener('scheduled', event => {
    const mockRequest = new Request('https://localhost', {
        method: 'POST'
    });
    event.waitUntil(handleRequest(mockRequest, event.env));
});
