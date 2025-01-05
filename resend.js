// 群发邮件的主逻辑
async function handleRequest(request, env) {
    try {
        // 验证必要的环境变量
        const requiredVars = ['RESEND_API_KEY', 'FROM_EMAIL', 'TO_EMAILS', 'TG_TOKEN', 'TG_ID'];
        for (const varName of requiredVars) {
            if (!env[varName]) {
                throw new Error(`环境变量 ${varName} 未设置`);
            }
        }
        
        const resendApiKey = env.RESEND_API_KEY;
        const fromEmail = env.FROM_EMAIL || "admin@yomoh.ggff.net";
        const subject = env.SUBJECT || "邮件测试";
        const body = env.BODY || "这是一封来自自动化脚本的邮件";
        const tgToken = env.TG_TOKEN;
        const tgId = env.TG_ID;

        // 添加邮件地址格式验证
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const toEmails = env.TO_EMAILS.split('\n')
            .map(email => email.trim())
            .filter(email => email && emailRegex.test(email));

        if (toEmails.length === 0) {
            throw new Error("没有有效的收件人邮箱地址");
        }

        // 添加超时处理
        const results = await Promise.all(
            toEmails.map(async (email) => {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
                    const success = await sendEmail(email, resendApiKey, fromEmail, subject, body);
                    clearTimeout(timeoutId);
                    return { email, success, error: null };
                } catch (error) {
                    // 区分超时错误和其他错误
                    const errorMessage = error.name === 'AbortError' 
                        ? '发送超时' 
                        : error.message;
                    return { email, success: false, error: errorMessage };
                }
            })
        );

        // 处理空结果的情况
        if (results.length === 0) {
            throw new Error("没有有效的邮件地址可以发送");
        }

        // 修改后的结果分析和消息格式
        const successCount = results.filter(res => res.success).length;
        const failureCount = results.length - successCount;
        const successEmails = results.filter(res => res.success).map(res => res.email);
        const failedResults = results.filter(res => !res.success);
        
        const resultMessage = `📊 邮件发送统计：
成功: ${successCount}，失败: ${failureCount}。

✅ 成功的邮件地址：
${successEmails.join('\n')}

❌失败的邮件地址:
${failedResults.map(res => `${res.email}\n错误信息：${res.error}`).join('\n')}`;
        
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

// 用于发送邮件的函数
async function sendEmail(toEmail, resendApiKey, fromEmail, subject, body) {
    const url = 'https://api.resend.com/emails';
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(url, {
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
        console.error(`发送邮件到 ${toEmail} 失败:`, error);
        throw error;
    }
}

// HTTP 触发器 - 用于手动触发邮件发送
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request, event.env));
});

// 定时触发器 - 用于自动定时发送邮件
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
