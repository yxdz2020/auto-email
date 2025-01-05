// 群发邮件的主逻辑
async function handleRequest(request, env) {
    // 初始化统计数据
    const stats = {
        total: 0,
        success: 0,
        failed: 0,
        successEmails: [],
        failedResults: [],
        startTime: new Date(),
        endTime: null
    };

    try {
        // 访问控制
        if (request.method === 'GET') {
            const url = new URL(request.url);
            const token = url.searchParams.get('token');
            if (!token || token !== env.ACCESS_TOKEN) {
                return new Response('未授权访问', { 
                    status: 401,
                    headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
                });
            }
        }

        // 验证必要的环境变量
        const requiredVars = ['MAILERSEND_API_KEY', 'FROM_EMAIL', 'TO_EMAILS', 'TG_TOKEN', 'TG_ID'];
        for (const varName of requiredVars) {
            if (!env[varName]) {
                throw new Error(`环境变量 ${varName} 未设置`);
            }
        }
        
        const mailersendApiKey = env.MAILERSEND_API_KEY;
        const fromEmail = env.FROM_EMAIL;
        const subject = env.SUBJECT || "邮件测试";
        const body = env.BODY || "这是一封来自自动化脚本的邮件";
        const tgToken = env.TG_TOKEN;
        const tgId = env.TG_ID;

        // 验证邮件内容
        validateEmailContent(subject, body);

        // 解析并验证收件人邮箱
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const toEmails = env.TO_EMAILS.split('\n')
