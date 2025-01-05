// 处理请求的主函数
async function handleRequest(request, env) {
    const url = new URL(request.url);
    
    // 验证 ACCESS_TOKEN
    if (env && env.ACCESS_TOKEN) {
        const token = url.searchParams.get('token');
        if (!token || token !== env.ACCESS_TOKEN) {
            return new Response('未授权访问', { 
                status: 401,
                headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
            });
        }
    }

    // 路由处理
    if (url.pathname === "/config") {
        // 验证请求方法
        if (!["GET", "POST"].includes(request.method)) {
            return new Response('方法不允许', { 
                status: 405,
                headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
            });
        }

        if (request.method === "GET") {
            try {
                const config = await env.EMAIL_CONFIG.get('email_settings');
                return new Response(config || '{}', {
                    headers: { 
                        'Content-Type': 'application/json;charset=UTF-8',
                        'Cache-Control': 'no-store'
                    }
                });
            } catch (error) {
                console.error('获取配置失败:', error);
                return new Response(JSON.stringify({ error: '获取配置失败' }), { 
                    status: 500,
                    headers: { 'Content-Type': 'application/json;charset=UTF-8' }
                });
            }
        } else if (request.method === "POST") {
            try {
                const config = await request.json();
                await env.EMAIL_CONFIG.put('email_settings', JSON.stringify(config));
                return new Response('配置已保存', { 
                    status: 200,
                    headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
                });
            } catch (error) {
                console.error('保存配置失败:', error);
                return new Response('保存配置失败', { 
                    status: 500,
                    headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
                });
            }
        }
    }

    if (url.pathname === "/send") {
        if (request.method !== "POST") {
            return new Response('方法不允许', { 
                status: 405,
                headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
            });
        }

        try {
            const formData = await request.formData();
            const emailData = {
                fromEmail: formData.get('fromEmail'),
                toEmails: formData.get('toEmails'),
                subject: formData.get('subject'),
                body: formData.get('body')
            }; 
            return handleEmailSending(emailData, env);
        } catch (error) {
            console.error('处理表单数据失败:', error);
            return new Response('处理请求失败', { 
                status: 400,
                headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
            });
        }
    }

    // 默认返回配置页面
    return new Response(getConfigHTML(), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });
}

// 获取配置页面 HTML
function getConfigHTML() {
    return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>邮件发送配置</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 20px auto;
                padding: 0 20px;
            }
            .form-group {
                margin-bottom: 15px;
            }
            label {
                display: block;
                margin-bottom: 5px;
                font-weight: bold;
            }
            input[type="text"], input[type="email"], textarea {
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                box-sizing: border-box;
            }
            button {
                background-color: #4CAF50;
                color: white;
                padding: 10px 15px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                margin-right: 10px;
            }
            button:hover {
                background-color: #45a049;
            }
            button:disabled {
                background-color: #cccccc;
                cursor: not-allowed;
            }
            .result {
                margin-top: 20px;
                padding: 10px;
                border-radius: 4px;
                white-space: pre-wrap;
            }
            .success {
                background-color: #dff0d8;
                border: 1px solid #d6e9c6;
                color: #3c763d;
            }
            .error {
                background-color: #f2dede;
                border: 1px solid #ebccd1;
                color: #a94442;
            }
            .loading {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-right: 5px;
                vertical-align: middle;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .button-group {
                margin-top: 15px;
            }
            .clear-button {
                background-color: #dc3545;
            }
            .clear-button:hover {
                background-color: #c82333;
            }
            /* 添加输入验证提示样式 */
            input:invalid, textarea:invalid {
                border-color: #dc3545;
            }
            .invalid-feedback {
                color: #dc3545;
                font-size: 0.875em;
                margin-top: 0.25rem;
                display: none;
            }
            input:invalid + .invalid-feedback,
            textarea:invalid + .invalid-feedback {
                display: block;
            }
        </style>
    </head>
    <body>
        <h1>邮件发送配置</h1>
        <form id="emailForm">
            <div class="form-group">
                <label for="fromEmail">发件人邮箱:</label>
                <input type="email" 
                    id="fromEmail" 
                    name="fromEmail" 
                    placeholder="请输入发件人邮箱" 
                    pattern="[^\\s@]+@[^\\s@]+\\.[^\\s@]+" 
                    required>
                <div class="invalid-feedback">请输入有效的邮箱地址</div>
            </div>
            <div class="form-group">
                <label for="toEmails">收件人邮箱列表 (每行一个):</label>
                <textarea id="toEmails" 
                    name="toEmails" 
                    rows="5" 
                    placeholder="请输入收件人邮箱，每行一个" 
                    required></textarea>
                <div class="invalid-feedback">请至少输入一个有效的邮箱地址</div>
            </div>
            <div class="form-group">
                <label for="subject">邮件主题:</label>
                <input type="text" 
                    id="subject" 
                    name="subject" 
                    placeholder="请输入邮件主题" 
                    required>
                <div class="invalid-feedback">主题不能为空</div>
            </div>
            <div class="form-group">
                <label for="body">邮件内容:</label>
                <textarea id="body" 
                    name="body" 
                    rows="10" 
                    placeholder="请输入邮件内容" 
                    required></textarea>
                <div class="invalid-feedback">邮件内容不能为空</div>
            </div>
            <div class="button-group">
                <button type="submit">发送邮件</button>
                <button type="button" class="clear-button">清空表单</button>
            </div>
        </form>
        <div id="result" style="display: none;" class="result"></div>

        <script>
            const form = document.getElementById('emailForm');
            const formFields = ['fromEmail', 'toEmails', 'subject', 'body'];
            const urlParams = window.location.search;
            const resultDiv = document.getElementById('result');
            const submitButton = form.querySelector('button[type="submit"]');
            const clearButton = form.querySelector('.clear-button');

            // 显示错误信息
            function showError(message) {
                resultDiv.textContent = message;
                resultDiv.className = 'result error';
                resultDiv.style.display = 'block';
            }

            // 显示成功信息
            function showSuccess(message) {
                resultDiv.textContent = message;
                resultDiv.className = 'result success';
                resultDiv.style.display = 'block';
            }

            // 加载配置
            async function loadConfig() {
                try {
                    const response = await fetch('/config' + urlParams);
                    if (!response.ok) throw new Error('加载配置失败');
                    const config = await response.json();
                    formFields.forEach(field => {
                        const element = document.getElementById(field);
                        if (config[field]) {
                            element.value = config[field];
                        }
                    });
                } catch (error) {
                    console.error('加载配置失败:', error);
                    showError('加载配置失败: ' + error.message);
                }
            }

            // 保存配置
            async function saveConfig() {
                try {
                    const config = Object.fromEntries(
                        formFields.map(field => [field, document.getElementById(field).value])
                    );

                    const response = await fetch('/config' + urlParams, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(config)
                    });

                    if (!response.ok) throw new Error('保存配置失败');
                } catch (error) {
                    console.error('保存配置失败:', error);
                }
            }

            // 事件监听器
            window.addEventListener('load', loadConfig);

            // 自动保存
            let saveTimeout;
            formFields.forEach(field => {
                document.getElementById(field).addEventListener('input', () => {
                    clearTimeout(saveTimeout);
                    saveTimeout = setTimeout(saveConfig, 1000);
                });
            });

            // 表单提交
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const originalButtonText = submitButton.textContent;
                
                try {
                    submitButton.disabled = true;
                    submitButton.innerHTML = '<span class="loading"></span>发送中...';
                    resultDiv.style.display = 'none';
                    
                    const response = await fetch('/send' + urlParams, {
                        method: 'POST',
                        body: new FormData(form)
                    });
                    
                    const result = await response.text();
                    
                    if (response.ok) {
                        showSuccess(result);
                        if (confirm('发送成功！是否清空表单？')) {
                            form.reset();
                            await saveConfig();
                        }
                    } else {
                        showError(result);
                    }
                } catch (error) {
                    showError('发送失败: ' + error.message);
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = originalButtonText;
                }
            });

            // 清空表单
            clearButton.addEventListener('click', async () => {
                if (confirm('确定要清空表单吗？')) {
                    form.reset();
                    await saveConfig();
                    resultDiv.style.display = 'none';
                }
            });
        </script>
    </body>
    </html>
    `;
}

// 处理邮件发送的函数
async function handleEmailSending(emailData, env) {
    const stats = {
        total: 0,
        success: 0,
        failed: 0,
        successEmails: [],
        failedResults: [],
        startTime: new Date(),
        endTime: null
    };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    try {
        // 验证必要的环境变量和数据
        if (!env.MAILERSEND_API_KEY) {
            throw new Error('MAILERSEND_API_KEY 未设置');
        }
        
        const fromEmail = (emailData.fromEmail?.trim() || env.FROM_EMAIL?.trim());
        if (!fromEmail) {
            throw new Error('发件人邮箱未设置');
        }
        if (!emailRegex.test(fromEmail)) {
            throw new Error('发件人邮箱格式无效');
        }

        const subject = emailData.subject?.trim() || env.SUBJECT || "邮件测试";
        const body = emailData.body?.trim() || env.BODY || "这是一封来自自动化脚本的邮件";
        
        // 验证邮件内容
        validateEmailContent(subject, body);

        // 解析并验证收件人邮箱
        let toEmails = [];

        // 优先从表单获取数据
        if (emailData.toEmails && emailData.toEmails.trim()) {
            toEmails = emailData.toEmails.split('\n')
                .map(email => email.trim())
                .filter(email => email && emailRegex.test(email));
        }

        // 如果表单数据为空且存在环境变量，则使用环境变量
        if (toEmails.length === 0 && env && env.TO_EMAILS) {
            toEmails = env.TO_EMAILS.split('\n')
                .map(email => email.trim())
                .filter(email => email && emailRegex.test(email));
        }

        // 验证是否有有效的收件人
        if (toEmails.length === 0) {
            throw new Error("没有有效的收件人邮箱地址");
        }

        stats.total = toEmails.length;

        // 批量发送邮件
        const BATCH_SIZE = 50;
        const DELAY_MS = 1000;

        for (let i = 0; i < toEmails.length; i += BATCH_SIZE) {
            const batch = toEmails.slice(i, i + BATCH_SIZE);
            console.log(`正在处理第 ${i + 1} 到 ${Math.min(i + BATCH_SIZE, toEmails.length)} 个邮件...`);
            
            const results = await Promise.all(
                batch.map(async (email) => {
                    try {
                        const success = await sendEmail(email, env.MAILERSEND_API_KEY, fromEmail, subject, body);
                        if (success) {
                            stats.success++;
                            stats.successEmails.push(email);
                        } else {
                            stats.failed++;
                            stats.failedResults.push({ email, error: '发送失败' });
                        }
                        return { email, success };
                    } catch (error) {
                        stats.failed++;
                        stats.failedResults.push({ email, error: error.message || '发送时发生错误' });
                        return { email, success: false };
                    }
                })
            );

            // 添加延迟，避免API限制
            if (i + BATCH_SIZE < toEmails.length) {
                console.log(`等待 ${DELAY_MS}ms 后继续...`);
                await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }
        }

        // 生成最终报告
        stats.endTime = new Date();
        const duration = (stats.endTime - stats.startTime) / 1000;
        
        const resultMessage = `📊 邮件发送统计：
总数: ${stats.total}
成功: ${stats.success}
失败: ${stats.failed}
用时: ${duration}秒

✅ 成功的邮件地址：
${stats.successEmails.join('\n')}

❌失败的邮件地址:
${stats.failedResults.map(res => `${res.email}\n错误信息：${res.error}`).join('\n')}`;

        // 如果配置了 Telegram，发送通知
        if (env.TG_TOKEN && env.TG_ID) {
            await sendTelegramNotification(resultMessage, env.TG_TOKEN, env.TG_ID);
        }

        return new Response(resultMessage, { 
            status: 200,
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
        });

    } catch (error) {
        const errorMessage = `❌ 执行过程中发生错误: ${error.message || '未知错误'}`;
        if (env.TG_TOKEN && env.TG_ID) {
            await sendTelegramNotification(errorMessage, env.TG_TOKEN, env.TG_ID);
        }
        return new Response(errorMessage, { 
            status: 500,
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
        });
    }
}

// 发送邮件的函数
async function sendEmail(toEmail, mailersendApiKey, fromEmail, subject, body) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            const response = await fetch('https://api.mailersend.com/v1/email', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${mailersendApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: {
                        email: fromEmail
                    },
                    to: [{
                        email: toEmail
                    }],
                    subject: subject,
                    text: body
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const responseData = await response.json().catch(() => ({}));
            
            if (response.ok) {
                console.log(`邮件已成功发送到 ${toEmail}`);
                return true;
            } else {
                throw new Error(`API 返回错误: ${responseData.message || '未知错误'}`);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('请求超时');
            }
            if (attempt === MAX_RETRIES) {
                console.error(`发送邮件到 ${toEmail} 失败:`, error);
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            console.log(`重试第 ${attempt} 次发送到 ${toEmail}`);
        }
    }
}

// 发送 Telegram 通知的函数
async function sendTelegramNotification(message, tgToken, tgId) {
    if (!tgToken || !tgId) {
        console.log('Telegram 配置未完成，跳过通知');
        return;
    }

    // Telegram 消息长度限制
    const MAX_MESSAGE_LENGTH = 4096;
    const messages = [];
    
    // 如果消息超长，分段发送
    if (message.length > MAX_MESSAGE_LENGTH) {
        for (let i = 0; i < message.length; i += MAX_MESSAGE_LENGTH) {
            messages.push(message.slice(i, i + MAX_MESSAGE_LENGTH));
        }
    } else {
        messages.push(message);
    }

    for (const msg of messages) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const response = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: tgId,
                    text: msg,
                    parse_mode: 'Markdown'
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Telegram API 错误: ${error}`);
            }

            // 如果有多条消息，添加延迟避免频率限制
            if (messages.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            const errorMessage = error.name === 'AbortError' 
                ? 'Telegram 通知发送超时' 
                : error.message;
            console.error('发送 Telegram 通知失败:', errorMessage);
        }
    }
}

// 验证邮件内容的函数
function validateEmailContent(subject, body) {
    if (!subject || subject.trim().length === 0) {
        throw new Error('邮件主题不能为空');
    }
    if (subject.length > 998) { // RFC 2822 规范
        throw new Error('邮件主题过长');
    }
    if (!body || body.trim().length === 0) {
        throw new Error('邮件内容不能为空');
    }
    if (body.length > 100000) {
        throw new Error('邮件内容过长');
    }
}

// 事件监听器
addEventListener('fetch', event => {
    event.respondWith(
        handleRequest(event.request, event.env)
            .catch(error => {
                console.error('请求处理失败:', error);
                return new Response('服务器内部错误', { 
                    status: 500,
                    headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
                });
            })
    );
});

// 定时触发器
addEventListener('scheduled', event => {
    event.waitUntil(
        handleRequest(
            new Request('https://dummy-url.com/scheduled', {
                method: 'POST',
                headers: new Headers({
                    'Content-Type': 'application/json',
                })
            }), 
            event.env
        ).catch(error => {
            console.error('定时任务执行失败:', error);
        })
    );
});
