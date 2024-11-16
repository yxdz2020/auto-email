// 从环境变量中获取配置
const smtpServer = SMTP_SERVER;  // 例如 smtp.mailgun.org
const smtpPort = SMTP_PORT || 587;  // 默认端口587
const smtpUser = SMTP_USER;  // Mailgun 或其他 SMTP 服务的用户名
const smtpPass = SMTP_PASS;  // Mailgun 或其他 SMTP 服务的密码
const fromEmail = FROM_EMAIL;  // 发件人邮箱
const toEmails = JSON.parse(TO_EMAILS);  // 收件人邮箱列表，环境变量存储的是一个 JSON 字符串
const subject = SUBJECT;  // 邮件主题
const body = BODY;  // 邮件正文
const mailgunApiKey = MAILGUN_API_KEY;  // 从环境变量中获取 Mailgun API 密钥

// 用于发送邮件的函数
async function sendEmail(toEmail) {
    const url = `https://api.mailgun.net/v3/your-domain.com/messages`; // Mailgun API URL

    // 使用 Mailgun API 发送邮件
    const formData = new FormData();
    formData.append('from', fromEmail);
    formData.append('to', toEmail);
    formData.append('subject', subject);
    formData.append('text', body);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + btoa('api:' + mailgunApiKey), // 使用环境变量中的 API 密钥
        },
        body: formData,
    });

    if (response.ok) {
        console.log(`邮件已成功发送到 ${toEmail}`);
    } else {
        console.log(`发送邮件到 ${toEmail} 失败: ${response.statusText}`);
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
