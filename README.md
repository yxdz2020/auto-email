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
**若需要tg通知，则新增以下两个变量**

- TG_ID tg机器人用户ID

- TG_TOKEN  tg机器人token

## 部署方式二：cf worker

到 [resend](https://resend.com/) 注册一个账号，申请 `apitoken`，并且绑定一个域名，根据 resend 的提示到域名托管商处添加相应的 dns 解析记录，有三个 `txt` 和一个 `mx` 记录。resend分配的测试域名邮箱是 `onboarding@resend.dev`

在 cf 新建一个 wokrer，粘贴仓库内 `resend.js` 中的内容

设置以下环境变量：

- RESEND_API_KEY = 填刚刚申请的 `apitoken`
- FROM_EMAIL = 发件人邮箱，邮箱域名必须与在 resend 中绑定的域名一致，前缀随意
- TO_EMAILS = 收件人邮箱，支持多个邮箱地址，每行一个
- TG_ID = TG 机器人的 chat id
- TG_TOKEN = TG 机器人的 token
- SUBJECT = 邮件主题
- BODY = 邮件正文

设置 `corn` 触发器，实现定时自动群发邮件

> 另一个免费的邮件群发api：[mailersend](https://app.mailersend.com/domains)
