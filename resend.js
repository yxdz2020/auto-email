// 从环境变量中获取配置（通过 env 参数传递）
async function sendEmail(toEmail, env) {
    const resendApiKey = env.RESEND_API_KEY; // Resend API 密钥
    const fromEmail = env.FROM_EMAIL || "admin@yomoh.ggff.net"; // 发件人邮箱
    const subject = env.SUBJECT || "定时邮件通知"; // 邮件主题
    const body = env.BODY || "这是一封来自自动化脚本的邮件"; // 邮件正文
    const url = `https://api.resend.com/emails`; // Resend API URL
    const emailData = {
        from: fromEmail,
        to: toEmail,
        subject: subject,
        text: body, // 邮件正文（纯文本）
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${resendApiKey}`, // 使用 Bearer Token 验证
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
    });

    if (response.ok) {
        console.log(`邮件已成功发送到 ${toEmail}`);
        return true;
    } else {
        const errorText = await response.text();
        console.log(`发送邮件到 ${toEmail} 失败: ${response.status} - ${errorText}`);
        return false;
    }
}

// 用于发送 Telegram 通知的函数
async function sendTelegramNotification(message, env) {
    const tgToken = env.TG_TOKEN; // Telegram Bot Token
    const tgChatId = env.TG_CHAT_ID; // Telegram Chat ID

    const tgUrl = `https://api.telegram.org/bot${tgToken}/sendMessage`;
    const tgData = {
        chat_id: tgChatId,
        text: message,
        parse_mode: "Markdown",
    };

    const response = await fetch(tgUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tgData),
    });

    if (!response.ok) {
        console.log(`Telegram 通知失败: ${response.status} - ${await response.text()}`);
    }
}

// 生成统计信息的函数
function generateSummary(successCount, failureCount, failedEmails) {
    return (
        `📊 群发邮件结果：\n✅ 发送成功: ${successCount} 封\n❌ 发送失败: ${failureCount} 封\n` +
        (failedEmails.length > 0 ? `失败邮箱列表: ${failedEmails.join(', ')}` : "所有邮件均发送成功")
    );
}

// 群发邮件主逻辑
async function handleRequest(event, env) {
    const toEmails = env.TO_EMAILS.split('\n')
        .map(email => email.trim())
        .filter(email => email); // 解析收件人
    const results = await Promise.all(
        toEmails.map(async (email) => {
            const success = await sendEmail(email, env);
            return { email, success };
        })
    );

    // 统计结果
    const successCount = results.filter(res => res.success).length;
    const failureCount = results.length - successCount;
    const failedEmails = results.filter(res => !res.success).map(res => res.email);

    // 生成总结
    const summary = generateSummary(successCount, failureCount, failedEmails);

    // 发送 Telegram 通知
    await sendTelegramNotification(summary, env);

    // 返回 HTTP 响应
    return new Response(summary, { status: 200 });
}

// HTTP 触发器
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event, event.request.cf.env));
});

// 定时触发器
addEventListener('scheduled', event => {
    event.waitUntil(handleRequest(event, event.env));
});
