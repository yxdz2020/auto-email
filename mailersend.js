// 群发邮件的主逻辑
async function handleRequest(request, env) {
    // 初始化统计数据
    const stats = {
        total: 0,
        success: 0,
        failed: 0,
        successEmails: [],
        failedResults: [],
        startTime: new Date(),
        endTime: null
    };

    try {
        // 访问控制
        if (request.method === 'GET') {
            const url = new URL(request.url);
            const token = url.searchParams.get('token');
            if (!token || token !== env.ACCESS_TOKEN) {
                return new Response('未授权访问', { 
                    status: 401,
                    headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
                });
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
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const toEmails = env.TO_EMAILS.split('\n')
            .map(email => email.trim())
            .filter(email => email && emailRegex.test(email));

        if (toEmails.length === 0) {
            throw new Error("没有有效的收件人邮箱地址");
        }

        stats.total = toEmails.length;

        // 批量发送邮件
        const BATCH_SIZE = 50;
        const DELAY_MS = 1000;

        for (let i = 0; i < toEmails.length; i += BATCH_SIZE) {
            const batch = toEmails.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(
                batch.map(async (email) => {
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 30000);
                        const success = await sendEmail(email, resendApiKey, fromEmail, subject, body);
                        clearTimeout(timeoutId);
                        
                        if (success) {
                            stats.success++;
                            stats.successEmails.push(email);
                        } else {
                            stats.failed++;
                            stats.failedResults.push({ email, error: '发送失败' });
                        }
                        return { email, success, error: null };
                    } catch (error) {
                        stats.failed++;
                        const errorMessage = error.name === 'AbortError' ? '发送超时' : error.message;
                        stats.failedResults.push({ email, error: errorMessage });
                        return { email, success: false, error: errorMessage };
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
        
        const resultMessage = `📊 邮件发送统计：
总数: ${stats.total}
成功: ${stats.success}
失败: ${stats.failed}
用时: ${duration}秒

✅ 成功的邮件地址：
${stats.successEmails.join('\n')}

❌失败的邮件地址:
${stats.failedResults.map(res => `${res.email}\n错误信息：${res.error}`).join('\n')}`;
        
        // 发送最终通知
        await sendTelegramNotification(resultMessage, tgToken, tgId);
        return new Response(resultMessage, { 
            status: 200,
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
        });

    } catch (error) {
        const errorMessage = `❌ 执行过程中发生错误: ${error.message || '未知错误'}`;
        await sendTelegramNotification(errorMessage, env.TG_TOKEN, env.TG_ID);
        return new Response(errorMessage, { 
            status: 500,
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
        });
    }
}

// 发送 Telegram 消息的函数
async function sendTelegramNotification(message, tgToken, tgId) {
    if (!tgToken || !tgId) {
        console.log('Telegram 配置未完成，跳过通知');
        return;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

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
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Telegram API 错误: ${error}`);
        }
    } catch (error) {
        const errorMessage = error.name === 'AbortError' 
            ? 'Telegram 通知发送超时' 
            : error.message;
        console.error('发送 Telegram 通知失败:', errorMessage);
    }
}

// 用于发送邮件的函数（带重试机制）
async function sendEmail(toEmail, resendApiKey, fromEmail, subject, body) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
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
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const responseData = await response.json().catch(() => ({}));
            
            if (response.ok) {
                console.log(`邮件已成功发送到 ${toEmail}`);
                return true;
            } else {
                throw new Error(`API 返回错误: ${responseData.message || '未知错误'}`);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('请求超时');
            }
            if (attempt === MAX_RETRIES) {
                console.error(`发送邮件到 ${toEmail} 失败:`, error);
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            console.log(`重试第 ${attempt} 次发送到 ${toEmail}`);
        }
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

// HTTP 触发器
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request, event.env));
});

// 定时触发器
addEventListener('scheduled', event => {
    event.waitUntil(
        handleRequest(
            new Request('https://dummy-url.com/scheduled', {
                method: 'POST',
                headers: new Headers({
                    'Content-Type': 'application/json',
                })
            }), 
            event.env
        )
    );
});
