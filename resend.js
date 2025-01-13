export default {
    async fetch(request, env, ctx) {
      try {
        // 加载邮件配置
        const emailConfig = loadEmailConfig(env);
        const { from_email, to_emails, subject, body } = emailConfig;
  
        // 加载 Telegram 配置
        const { tg_id, tg_token } = loadTelegramConfig(env);
  
        const successEmails = [];
        const failedEmailsWithReasons = {};
  
        // 群发邮件
        for (const email of to_emails) {
          try {
            const result = await sendEmail(email, subject, body, env.RESEND_API_KEY, from_email);
            if (result) {
              successEmails.push(email);
            } else {
              failedEmailsWithReasons[email] = "未知错误";
            }
          } catch (error) {
            failedEmailsWithReasons[email] = error.message;
          }
        }
  
        // 发送 Telegram 通知
        if (tg_id && tg_token) {
          await sendTelegramNotification(tg_id, tg_token, successEmails, failedEmailsWithReasons);
        } else {
          console.log("Telegram 通知配置缺失，跳过发送 Telegram 通知。");
        }
  
        return new Response("邮件发送任务完成", { status: 200 });
      } catch (error) {
        console.error("脚本运行时发生异常:", error);
        return new Response("脚本运行时发生异常", { status: 500 });
      }
    },
  
    // 支持 Cron 触发器
    async scheduled(event, env, ctx) {
      return await this.fetch(null, env, ctx);
    },
};
  
// 加载邮件配置
function loadEmailConfig(env) {
    const from_email = env.FROM_EMAIL;
    const to_emails_raw = env.TO_EMAILS;
    const subject = env.SUBJECT;
    const body = env.BODY;
  
    if (!from_email || !to_emails_raw || !subject || !body) {
      throw new Error("邮件配置缺失，请检查环境变量设置。");
    }
  
    // 解析收件人列表
    const to_emails = to_emails_raw
      .split(/[\n,]+/) // 支持换行符或逗号分隔
      .map(email => email.trim())
      .filter(email => email.length > 0);
  
    if (to_emails.length === 0) {
      throw new Error("收件人列表为空，请检查 TO_EMAILS 配置。");
    }
  
    return { from_email, to_emails, subject, body };
}
  
// 加载 Telegram 配置
function loadTelegramConfig(env) {
    const tg_id = env.TG_ID;
    const tg_token = env.TG_TOKEN;
  
    if (tg_id && isNaN(Number(tg_id))) {
      throw new Error("Telegram 配置中的 'TG_ID' 应为数字，请检查配置。");
    }
    if (tg_token && !tg_token.includes(":")) {
      throw new Error("Telegram 配置中的 'TG_TOKEN' 格式不正确，请检查配置。");
    }
  
    return { tg_id, tg_token };
}
  
// 使用 Resend API 发送邮件
async function sendEmail(to_email, subject, body, resendApiKey, from_email) {
    const url = "https://api.resend.com/emails";
    const payload = {
      from: from_email,
      to: [to_email],
      subject: subject,
      html: body,
    };
  
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    };
  
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });
  
    if (response.ok) {
      console.log(`邮件已成功发送到 ${to_email}`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`发送邮件到 ${to_email} 失败: ${response.status} - ${errorText}`);
      throw new Error(`发送邮件失败: ${errorText}`);
    }
}
  
// 发送 Telegram 通知
async function sendTelegramNotification(tg_id, tg_token, successEmails, failedEmailsWithReasons) {
    const now = new Date().toISOString().replace("T", " ").split(".")[0];
  
    // 统计成功和失败的数量
    const successCount = successEmails.length;
    const failureCount = Object.keys(failedEmailsWithReasons).length;
    const totalCount = successCount + failureCount;
  
    // 构建消息头部
    let message = `🤖 **邮件群发状态报告**\n⏰ 时间: \`${now}\`\n📊 总计: \`${totalCount}\` 个邮箱\n✅ 成功: \`${successCount}\`个 | ❌ 失败: \`${failureCount}\`个\n\n`;
  
    // 添加成功的邮箱列表
    for (const email of successEmails) {
      message += `邮箱：\`${email}\`\n状态: ✅ 发送成功\n`;
    }
  
    // 添加失败的邮箱列表及原因
    for (const [email, reason] of Object.entries(failedEmailsWithReasons)) {
      message += `邮箱：\`${email}\`\n状态: ❌ 发送失败\n失败原因: ${reason}\n`;
    }
  
    // 发送消息
    const url = `https://api.telegram.org/bot${tg_token}/sendMessage`;
    const payload = {
      chat_id: tg_id,
      text: message,
      parse_mode: "Markdown",
    };
  
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  
    if (response.ok) {
      console.log("Telegram 通知发送成功");
    } else {
      const errorText = await response.text();
      console.error(`Telegram 通知发送失败: ${response.status} - ${errorText}`);
      throw new Error(`Telegram 通知发送失败: ${errorText}`);
    }
}
