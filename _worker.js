// 从环境变量中获取配置
const resendApiKey = RESEND_API_KEY;  // Resend API 密钥
const fromEmail = FROM_EMAIL;  // 发件人邮箱
const toEmails = JSON.parse(TO_EMAILS);  // 收件人邮箱列表，环境变量存储的是一个 JSON 字符串
const subject = SUBJECT;  // 邮件主题
const body = BODY;  // 邮件正文

// 用于发送邮件的函数
async function sendEmail(toEmail) {
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
    } else {
        console.log(`发送邮件到 ${toEmail} 失败: ${response.status} - ${await response.text()}`);
    }
}

async function handleRequest(event) {
    // 群发邮件
    for (const email of toEmails) {
        await sendEmail(email);
    }
    return new Response('Emails sent successfully!', { status: 200 });
}

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event));
});

// Cloudflare Worker 定时触发器
addEventListener('scheduled', event => {
    event.waitUntil(handleRequest(event));
});
