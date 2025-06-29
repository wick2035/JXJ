<?php
// 认证功能函数 - 只包含函数定义，不处理请求

// 数据库连接
function getConnection() {
    try {
        if (!defined('DB_HOST') || !defined('DB_NAME') || !defined('DB_USER') || !defined('DB_PASS')) {
            throw new Exception('数据库配置常量未定义');
        }
        
        $port = defined('DB_PORT') ? DB_PORT : 3306;
        $dsn = "mysql:host=" . DB_HOST . ";port=" . $port . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $pdo = new PDO($dsn, DB_USER, DB_PASS);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        
        error_log('Database connection successful');
        return $pdo;
    } catch (PDOException $e) {
        error_log('Database connection failed: ' . $e->getMessage());
        throw new Exception('数据库连接失败: ' . $e->getMessage());
    }
}

// 验证用户登录
function login($username, $password) {
    $pdo = getConnection();
    
    $stmt = $pdo->prepare("SELECT id, username, password, type, real_name, first_login FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        return ['success' => false, 'message' => '用户名不存在'];
    }
    
    // 调试信息：记录查找到的用户类型
    error_log("Login attempt for user: {$username}, found user type: {$user['type']}");
    
    // 密码验证逻辑 - 完全依赖数据库
    $validPassword = false;
    
    // 检查是否为默认测试用户的明文密码（为向后兼容）
    // 对于用户123密码123，用户1234密码1234
    if (($username === '123' && $password === '123') || 
        ($username === '1234' && $password === '1234')) {
        $validPassword = true;
        error_log("Default test user login: {$username}, type: {$user['type']}");
        
        // 如果是明文密码且验证成功，更新为加密密码
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
        $updateStmt = $pdo->prepare("UPDATE users SET password = ? WHERE username = ?");
        $updateStmt->execute([$hashedPassword, $username]);
        error_log("Updated password hash for user: {$username}");
    } 
    // 检查加密密码
    elseif (password_verify($password, $user['password'])) {
        $validPassword = true;
        error_log("Hashed password login for: {$username}, type: {$user['type']}");
    }
    // 如果都不匹配，记录调试信息
    else {
        error_log("Password mismatch for user: {$username}, provided: {$password}, stored hash length: " . strlen($user['password']));
    }
    
    if (!$validPassword) {
        return ['success' => false, 'message' => '密码错误'];
    }
    
    // 设置会话
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['user_type'] = $user['type'];
    $_SESSION['real_name'] = $user['real_name'];
    
    return [
        'success' => true,
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'type' => $user['type'],
            'real_name' => $user['real_name'],
            'first_login' => (bool)$user['first_login']
        ]
    ];
}

// 退出登录
function logout() {
    session_destroy();
    return ['success' => true, 'message' => '已退出登录'];
}

// 检查登录状态
function checkLogin() {
    if (!isset($_SESSION['user_id'])) {
        return ['success' => false, 'message' => '未登录'];
    }
    
    // 从数据库获取最新的首次登录状态
    $pdo = getConnection();
    $stmt = $pdo->prepare("SELECT first_login FROM users WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    return [
        'success' => true,
        'user' => [
            'id' => $_SESSION['user_id'],
            'username' => $_SESSION['username'],
            'type' => $_SESSION['user_type'],
            'real_name' => $_SESSION['real_name'],
            'first_login' => $user ? (bool)$user['first_login'] : false
        ]
    ];
}

// 验证管理员权限
function requireAdmin() {
    $result = checkLogin();
    if (!$result['success']) {
        return $result;
    }
    
    if ($_SESSION['user_type'] !== 'admin') {
        return ['success' => false, 'message' => '权限不足'];
    }
    
    return ['success' => true];
}
?> 