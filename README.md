# auto-email
自动定时群发邮件

## 部署方式一：github action

在你的 GitHub 仓库中，依次点击 Settings -> Secrets -> Actions，然后点击 New repository secret，创建一个名为`EMAIL_CONFIG`的机密变量，内容为你的邮件配置信息。

`EMAIL_CONFIG`机密变量的`JSON`格式如下：
```
{
  "smtp_server": "smtp.example.com",
  "smtp_port": 587,
  "smtp_user": "your_email@example.com",
  "smtp_pass": "your_password",
  "from_email": "your_email@example.com",
  "to_emails": [
    "recipient1@example.com",
    "recipient2@example.com",
    "recipient3@example.com",
    "recipient4@example.com",
    "recipient5@example.com"
  ],
  "subject": "定时邮件通知",
  "body": "这是一封来自自动化脚本的邮件。"
}
```

## 部署方式二：cf worker

到 [resend](https://resend.com/) 注册一个账号，申请 `apitoken`

在 cf 新建一个 wokrer，粘贴仓库内 `_worker.js` 中的内容

设置以下环境变量：

- RESEND_API_KEY = 填刚刚申请的 `apitoken`
- FROM_EMAIL = 发件人邮箱
- TO_EMAILS = 收件人邮箱，支持多个邮箱地址，每行一个
- SUBJECT = 邮件主题
- BODY = 邮件正文

设置 corn 触发器，实现定时自动群发邮件
