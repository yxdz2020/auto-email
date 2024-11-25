import smtplib
import json
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# 从 GitHub Secrets 中读取 JSON 格式的邮件配置信息
config_json = os.getenv('EMAIL_CONFIG')
config = json.loads(config_json)

# 检查必需字段是否存在
required_fields = ['smtp_server', 'smtp_port', 'smtp_user', 'smtp_pass', 'from_email', 'to_emails', 'subject', 'body']
for field in required_fields:
    if field not in config:
        raise ValueError(f"配置中缺少必需字段: {field}")

smtp_server = config['smtp_server']
smtp_port = int(config['smtp_port'])  # 确保端口号为整数
smtp_user = config['smtp_user']
smtp_pass = config['smtp_pass']
from_email = config['from_email']
to_emails = config['to_emails']  # 这里是一个邮件列表
subject = config['subject']
body = config['body']

# 检查收件人列表类型
if not isinstance(to_emails, list):
    raise ValueError("配置中的 'to_emails' 应为一个邮件地址列表")

def send_email(to_email):
    # 设置邮件内容
    msg = MIMEMultipart()
    msg['From'] = from_email
    msg['To'] = to_email
    msg['Subject'] = subject

    # 支持 HTML 内容
    msg.attach(MIMEText(body, 'html'))

    try:
        # 根据端口号选择加密方式
        if smtp_port == 465:
            # 使用 SMTP_SSL 直接启用 SSL
            with smtplib.SMTP_SSL(smtp_server, smtp_port) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, to_email, msg.as_string())
        elif smtp_port == 587:
            # 使用 SMTP 和 starttls() 启用 TLS
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, to_email, msg.as_string())
        else:
            print(f"不支持的端口号: {smtp_port}")
            return

        print(f"邮件已成功发送到 {to_email}")
    except Exception as e:
        print(f"发送邮件到 {to_email} 失败: {str(e)}")

if __name__ == "__main__":
    # 群发邮件
    for email in to_emails:
        send_email(email)
