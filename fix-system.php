<?php
/**
 * 奖学金系统修复脚本
 * 自动修复常见的系统问题
 */

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>系统修复脚本</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; }
        .section { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .success { color: green; }
        .error { color: red; }
        .warning { color: orange; }
        .info { color: blue; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>奖学金系统修复脚本</h1>
    
    <div class="section">
        <h2>1. 检查并修复uploads目录</h2>
        <?php
        $uploadsDir = 'uploads';
        
        // 检查目录是否存在
        if (!is_dir($uploadsDir)) {
            echo '<p class="error">✗ uploads目录不存在，正在创建...</p>';
            if (mkdir($uploadsDir, 0755, true)) {
                echo '<p class="success">✓ uploads目录创建成功</p>';
            } else {
                echo '<p class="error">✗ uploads目录创建失败</p>';
            }
        } else {
            echo '<p class="success">✓ uploads目录已存在</p>';
        }
        
        // 检查目录权限
        if (is_writable($uploadsDir)) {
            echo '<p class="success">✓ uploads目录可写</p>';
        } else {
            echo '<p class="error">✗ uploads目录不可写</p>';
            if (chmod($uploadsDir, 0755)) {
                echo '<p class="success">✓ uploads目录权限已修复</p>';
            } else {
                echo '<p class="error">✗ uploads目录权限修复失败</p>';
            }
        }
        
        // 检查.htaccess文件
        $htaccessFile = $uploadsDir . '/.htaccess';
        if (!file_exists($htaccessFile)) {
            echo '<p class="warning">⚠ uploads/.htaccess文件不存在，正在创建...</p>';
            $htaccessContent = "# 允许访问上传的文件\nOptions +Indexes\nDirectoryIndex index.html\n\n# 防止执行PHP文件（安全考虑）\n<Files ~ \"\\.php$\">\n    Order Allow,Deny\n    Deny from all\n</Files>";
            if (file_put_contents($htaccessFile, $htaccessContent)) {
                echo '<p class="success">✓ uploads/.htaccess文件创建成功</p>';
            } else {
                echo '<p class="error">✗ uploads/.htaccess文件创建失败</p>';
            }
        } else {
            echo '<p class="success">✓ uploads/.htaccess文件已存在</p>';
        }
        
        // 检查index.html文件
        $indexFile = $uploadsDir . '/index.html';
        if (!file_exists($indexFile)) {
            echo '<p class="warning">⚠ uploads/index.html文件不存在，正在创建...</p>';
            $indexContent = "<!DOCTYPE html>\n<html>\n<head><title>Uploads Directory</title></head>\n<body><h1>文件上传目录</h1><p>此目录用于存储上传的文件。</p></body>\n</html>";
            if (file_put_contents($indexFile, $indexContent)) {
                echo '<p class="success">✓ uploads/index.html文件创建成功</p>';
            } else {
                echo '<p class="error">✗ uploads/index.html文件创建失败</p>';
            }
        } else {
            echo '<p class="success">✓ uploads/index.html文件已存在</p>';
        }
        ?>
    </div>
    
    <div class="section">
        <h2>2. 检查PHP配置</h2>
        <?php
        echo '<p class="info">PHP版本: ' . phpversion() . '</p>';
        
        // 检查文件上传配置
        $uploadMaxFilesize = ini_get('upload_max_filesize');
        $postMaxSize = ini_get('post_max_size');
        $maxFileUploads = ini_get('max_file_uploads');
        
        echo '<p class="info">上传最大文件大小: ' . $uploadMaxFilesize . '</p>';
        echo '<p class="info">POST最大大小: ' . $postMaxSize . '</p>';
        echo '<p class="info">最大上传文件数: ' . $maxFileUploads . '</p>';
        
        // 检查必要的PHP扩展
        $requiredExtensions = ['pdo', 'pdo_mysql', 'json', 'session'];
        foreach ($requiredExtensions as $ext) {
            if (extension_loaded($ext)) {
                echo '<p class="success">✓ ' . $ext . ' 扩展已加载</p>';
            } else {
                echo '<p class="error">✗ ' . $ext . ' 扩展未加载</p>';
            }
        }
        ?>
    </div>
    
    <div class="section">
        <h2>3. 测试数据库连接</h2>
        <?php
        if (file_exists('config.php')) {
            echo '<p class="success">✓ config.php文件存在</p>';
            require_once 'config.php';
            
            try {
                $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
                $pdo = new PDO($dsn, DB_USER, DB_PASS);
                $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                echo '<p class="success">✓ 数据库连接成功</p>';
                
                // 检查用户表
                $stmt = $pdo->query("SHOW TABLES LIKE 'users'");
                if ($stmt->rowCount() > 0) {
                    echo '<p class="success">✓ users表存在</p>';
                    
                    // 检查默认用户
                    $stmt = $pdo->query("SELECT COUNT(*) FROM users");
                    $userCount = $stmt->fetchColumn();
                    echo '<p class="info">用户总数: ' . $userCount . '</p>';
                } else {
                    echo '<p class="error">✗ users表不存在</p>';
                }
                
            } catch (Exception $e) {
                echo '<p class="error">✗ 数据库连接失败: ' . $e->getMessage() . '</p>';
            }
        } else {
            echo '<p class="error">✗ config.php文件不存在</p>';
        }
        ?>
    </div>
    
    <div class="section">
        <h2>4. 测试API响应</h2>
        <?php
        $apis = ['auth.php', 'users.php', 'upload.php', 'categories.php'];
        foreach ($apis as $api) {
            $apiPath = 'api/' . $api;
            if (file_exists($apiPath)) {
                echo '<p class="success">✓ ' . $apiPath . ' 文件存在</p>';
            } else {
                echo '<p class="error">✗ ' . $apiPath . ' 文件不存在</p>';
            }
        }
        ?>
    </div>
    
    <div class="section">
        <h2>5. 修复建议</h2>
        <h3>如果用户管理不显示：</h3>
        <ul>
            <li>确保以管理员身份登录（用户名：1234，密码：1234）</li>
            <li>检查浏览器控制台是否有JavaScript错误</li>
            <li>清空浏览器缓存</li>
        </ul>
        
        <h3>如果文件上传失败：</h3>
        <ul>
            <li>确保uploads目录有正确的权限（755）</li>
            <li>检查PHP的upload_max_filesize和post_max_size设置</li>
            <li>确保在学生身份下操作</li>
        </ul>
        
        <h3>调试步骤：</h3>
        <ol>
            <li>访问 <a href="debug.html" target="_blank">debug.html</a> 进行系统诊断</li>
            <li>访问 <a href="test-file-access.html" target="_blank">test-file-access.html</a> 测试文件访问</li>
            <li>访问 <a href="test-upload.html" target="_blank">test-upload.html</a> 测试文件上传</li>
        </ol>
    </div>
    
    <div class="section">
        <h2>6. 快速测试链接</h2>
        <p><a href="index.html" target="_blank">→ 打开奖学金系统主页</a></p>
        <p><a href="debug.html" target="_blank">→ 打开系统调试页面</a></p>
        <p><a href="test-file-access.html" target="_blank">→ 测试文件访问</a></p>
        <p><a href="uploads/" target="_blank">→ 访问uploads目录</a></p>
    </div>
    
    <p><em>修复完成！如果问题仍然存在，请检查Web服务器配置和PHP设置。</em></p>
</body>
</html> 