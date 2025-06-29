<?php
// 系统状态检查页面
header('Content-Type: text/html; charset=utf-8');

echo "<!DOCTYPE html>
<html lang='zh-CN'>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>系统状态检查</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        .success { color: #22c55e; background: #f0f9ff; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .error { color: #ef4444; background: #fef2f2; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .info { color: #3b82f6; background: #eff6ff; padding: 10px; border-radius: 4px; margin: 10px 0; }
        h2 { color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
        pre { background: #f9fafb; padding: 15px; border-radius: 6px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class='container'>
        <h1>奖学金评定系统 - 状态检查</h1>";

// 1. 检查配置文件
echo "<h2>1. 配置文件检查</h2>";
if (file_exists('config.php')) {
    echo "<div class='success'>✓ config.php 存在</div>";
    require_once 'config.php';
    
    // 检查必要常量
    $required_constants = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS', 'UPLOAD_PATH'];
    foreach ($required_constants as $const) {
        if (defined($const)) {
            echo "<div class='success'>✓ {$const} 已定义: " . constant($const) . "</div>";
        } else {
            echo "<div class='error'>✗ {$const} 未定义</div>";
        }
    }
} else {
    echo "<div class='error'>✗ config.php 不存在</div>";
    exit;
}

// 2. 检查数据库连接
echo "<h2>2. 数据库连接检查</h2>";
try {
    $dsn = "mysql:host=" . DB_HOST . ";port=" . (defined('DB_PORT') ? DB_PORT : 3306) . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "<div class='success'>✓ 数据库连接成功</div>";
    
    // 检查表结构
    $tables = ['users', 'categories', 'items', 'batches', 'applications', 'application_materials', 'uploaded_files', 'announcements'];
    foreach ($tables as $table) {
        $stmt = $pdo->prepare("SHOW TABLES LIKE ?");
        $stmt->execute([$table]);
        if ($stmt->fetch()) {
            echo "<div class='success'>✓ 表 {$table} 存在</div>";
        } else {
            echo "<div class='error'>✗ 表 {$table} 不存在</div>";
        }
    }
    
} catch (Exception $e) {
    echo "<div class='error'>✗ 数据库连接失败: " . $e->getMessage() . "</div>";
}

// 3. 检查用户数据
echo "<h2>3. 用户数据检查</h2>";
try {
    $stmt = $pdo->prepare("SELECT username, type FROM users");
    $stmt->execute();
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (count($users) > 0) {
        echo "<div class='success'>✓ 找到 " . count($users) . " 个用户</div>";
        foreach ($users as $user) {
            echo "<div class='info'>- {$user['username']} ({$user['type']})</div>";
        }
    } else {
        echo "<div class='error'>✗ 没有找到用户</div>";
    }
} catch (Exception $e) {
    echo "<div class='error'>✗ 查询用户失败: " . $e->getMessage() . "</div>";
}

// 4. 检查类目和奖项数据
echo "<h2>4. 类目和奖项数据检查</h2>";
try {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM categories");
    $stmt->execute();
    $categoryCount = $stmt->fetchColumn();
    
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM items");
    $stmt->execute();
    $itemCount = $stmt->fetchColumn();
    
    echo "<div class='success'>✓ 类目数量: {$categoryCount}</div>";
    echo "<div class='success'>✓ 奖项数量: {$itemCount}</div>";
    
} catch (Exception $e) {
    echo "<div class='error'>✗ 查询类目/奖项失败: " . $e->getMessage() . "</div>";
}

// 5. 检查API文件
echo "<h2>5. API文件检查</h2>";
$api_files = ['api/auth.php', 'api/users.php', 'api/categories.php', 'api/applications.php', 'api/upload.php'];
foreach ($api_files as $file) {
    if (file_exists($file)) {
        echo "<div class='success'>✓ {$file} 存在</div>";
    } else {
        echo "<div class='error'>✗ {$file} 不存在</div>";
    }
}

// 6. 检查上传目录
echo "<h2>6. 上传目录检查</h2>";
$upload_dir = UPLOAD_PATH;
if (is_dir($upload_dir)) {
    echo "<div class='success'>✓ 上传目录存在: {$upload_dir}</div>";
    if (is_writable($upload_dir)) {
        echo "<div class='success'>✓ 上传目录可写</div>";
    } else {
        echo "<div class='error'>✗ 上传目录不可写</div>";
    }
} else {
    echo "<div class='error'>✗ 上传目录不存在: {$upload_dir}</div>";
    if (mkdir($upload_dir, 0755, true)) {
        echo "<div class='success'>✓ 已创建上传目录</div>";
    } else {
        echo "<div class='error'>✗ 无法创建上传目录</div>";
    }
}

// 7. 测试API调用
echo "<h2>7. API测试</h2>";
echo "<div class='info'>测试结果请在浏览器开发者工具中查看</div>";
echo "<script>
async function testAPI() {
    console.log('开始API测试...');
    
    // 测试类目API
    try {
        const response = await fetch('api/categories.php?action=list_with_items');
        const data = await response.json();
        console.log('类目API测试:', data);
    } catch (error) {
        console.error('类目API测试失败:', error);
    }
    
    // 测试批次API
    try {
        const response = await fetch('api/applications.php?action=getBatches');
        const data = await response.json();
        console.log('批次API测试:', data);
    } catch (error) {
        console.error('批次API测试失败:', error);
    }
    
    console.log('API测试完成');
}

// 页面加载后执行测试
document.addEventListener('DOMContentLoaded', testAPI);
</script>";

echo "<p><a href='index.html'>返回主页</a></p>";
echo "</div></body></html>";
?> 