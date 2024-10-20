import smtplib
import json
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# 从 GitHub Secrets 中读取 JSON 格式的邮件配置信息
config_json = os.getenv('EMAIL_CONFIG')
config = json.loads(config_json)

smtp_server = config['smtp_server']
smtp_port = config['smtp_port']
smtp_user = config['smtp_user']
smtp_pass = config['smtp_pass']
from_email = config['from_email']
to_emails = config['to_emails']  # 这里是一个邮件列表
subject = config['subject']
body = config['body']

def send_email(to_email):
    # 设置邮件内容
    msg = MIMEMultipart()
    msg['From'] = from_email
    msg['To'] = to_email
    msg['Subject'] = subject

    msg.attach(MIMEText(body, 'plain'))

    try:
        # 连接到 SMTP 服务器并发送邮件
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()  # 使用 TLS 加密
            server.login(smtp_user, smtp_pass)
            server.sendmail(from_email, to_email, msg.as_string())
        print(f"邮件已成功发送到 {to_email}")
    except Exception as e:
        print(f"发送邮件到 {to_email} 失败: {str(e)}")

if __name__ == "__main__":
    # 群发邮件
    for email in to_emails:
        send_email(email)
