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
        const toEmails = env.TO_EMAILS.split('\n').map(email => email.trim()).filter(email => email);

        if (toEmails.length === 0) {
            throw new Error("没有有效的收件人邮箱地址");
        }

        const results = await Promise.all(
            toEmails.map(async (email) => {
                try {
                    const success = await sendEmail(email, resendApiKey, fromEmail, subject, body, tgToken, tgId);
                    return { email, success };
                } catch (error) {
                    console.error(`发送邮件到 ${email} 时发生错误: ${error.message}`);
                    await sendTelegramNotification(`❌ 发送邮件到 **${email}** 失败: ${error.message}`, tgToken, tgId);
                    return { email, success: false };
                }
            })
        );

        // 分析结果
        const successCount = results.filter(res => res.success).length;
        const failureCount = results.length - successCount;
        const failedEmails = results.filter(res => !res.success).map(res => res.email);
        const resultMessage = `✅ **邮件发送统计**：\n成功: ${successCount}，失败: ${failureCount}。\n失败的邮件地址: ${failedEmails.join('\n')}`;
        
        // 发送最终通知
        await sendTelegramNotification(resultMessage, tgToken, tgId);
        return new Response(resultMessage, { status: 200 });

    } catch (error) {
        const errorMessage = `❌ 执行过程中发生错误: ${error.message}`;
        await sendTelegramNotification(errorMessage, env.TG_TOKEN, env.TG_ID);
        return new Response(errorMessage, { status: 500 });
    }
}

// 发送 Telegram 消息的函数
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

// 用于发送邮件的函数
async function sendEmail(toEmail, resendApiKey, fromEmail, subject, body, tgToken, tgId) {
    const url = 'https://api.resend.com/emails';
    try {
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
        });

        const responseData = await response.json().catch(() => ({}));
        
        if (response.ok) {
            console.log(`邮件已成功发送到 ${toEmail}`);
            await sendTelegramNotification(`✅ 邮件已成功发送到 **${toEmail}**`, tgToken, tgId);
            return true;
        } else {
            throw new Error(`API 返回错误: ${responseData.message || '未知错误'}`);
        }
    } catch (error) {
        console.error(`发送邮件到 ${toEmail} 失败:`, error);
        await sendTelegramNotification(`❌ 发送邮件到 **${toEmail}** 失败: ${error.message}`, tgToken, tgId);
        return false;
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
