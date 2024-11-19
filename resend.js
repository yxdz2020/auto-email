// 群发邮件的主逻辑
async function handleRequest(request, env) {
    const resendApiKey = env.RESEND_API_KEY || "";  // 从环境变量获取 Resend API 密钥
    if (!resendApiKey) { throw new Error("RESEND_API_KEY 未设置或为空，无法发送邮件！"); }
    const fromEmail = env.FROM_EMAIL || "admin@yomoh.ggff.net";  // 从环境变量获取发件人邮箱
    const subject = env.SUBJECT || "邮件测试";  // 从环境变量获取邮件主题
    const body = env.BODY || "这是一封来自自动化脚本的邮件";  // 从环境变量获取邮件正文
    const tgToken = env.TG_TOKEN;  // Telegram Bot API Token
    const tgId = env.TG_ID;  // 目标 Telegram chat ID
    const toEmails = env.TO_EMAILS.split('\n').map(email => email.trim()).filter(email => email);  // 解析收件人
    if (toEmails.length === 0) { throw new Error("没有有效的收件人邮箱地址"); }

    const results = await Promise.all(
        toEmails.map(async (email) => {
            try {
                const success = await sendEmail(email, resendApiKey, fromEmail, subject, body, tgToken, tgId);
                return { email, success };
            } catch (error) {
                console.log(`发送邮件到 ${email} 时发生错误: ${error.message}`);
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
    await sendTelegramNotification(resultMessage, tgToken, tgId);  // 发送 Telegram 通知    
    return new Response(resultMessage, { status: 200 });
}

// 发送 Telegram 消息的函数
async function sendTelegramNotification(message, tgToken, tgId) {
    const url = `https://api.telegram.org/bot${tgToken}/sendMessage`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: tgId,
            text: message,
            parse_mode: 'Markdown'  // 使用 Markdown 格式
        }),
    });

    if (response.ok) {
        console.log('TG 通知发送成功');
    } else {
        console.log(`TG 通知发送失败: ${response.status}`);
    }
}

// 用于发送邮件的函数
async function sendEmail(toEmail, resendApiKey, fromEmail, subject, body, tgToken, tgId) {
    const url = 'https://api.resend.com/emails'; // Resend API URL
    const emailData = {
        from: fromEmail,
        to: toEmail,  // 这里只需要一个收件人邮箱
        subject: subject,
        text: body,  // 邮件正文（纯文本）
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${resendApiKey}`,  // 使用 Bearer Token 验证
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
    });

    if (response.ok) {
        console.log(`邮件已成功发送到 ${toEmail}`);
        await sendTelegramNotification(`✅ 邮件已成功发送到 **${toEmail}**`, tgToken, tgId);  // 发送 Telegram 通知，使用中文和 Markdown
        return true;
    } else {
        console.log(`发送邮件到 ${toEmail} 失败: ${response.status} - ${await response.text()}`);
        await sendTelegramNotification(`❌ 发送邮件到 **${toEmail}** 失败`, tgToken, tgId);  // 发送 Telegram 通知，使用中文和 Markdown
        return false;
    }
}

// HTTP 触发器
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request, event.env));
});

// 定时触发器（Cron Jobs）
addEventListener('scheduled', event => {
    event.waitUntil(handleRequest(event, event.env));
});
