<?php
// 认证功能函数 - 只包含函数定义，不处理请求

// 数据库连接
function getConnection() {
    try {
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $pdo = new PDO($dsn, DB_USER, DB_PASS);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        return $pdo;
    } catch (PDOException $e) {
        throw new Exception('数据库连接失败: ' . $e->getMessage());
    }
}

// 验证用户登录
function login($username, $password) {
    $pdo = getConnection();
    
    $stmt = $pdo->prepare("SELECT id, username, password, type, real_name FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        return ['success' => false, 'message' => '用户名不存在'];
    }
    
    // 调试信息：记录查找到的用户类型
    error_log("Login attempt for user: {$username}, found user type: {$user['type']}");
    
    // 密码验证逻辑 - 完全依赖数据库
    $validPassword = false;
    
    // 检查是否为测试用户且密码为明文存储（向后兼容）
    if (($username === '123' || $username === '1234') && $user['password'] === $password) {
        $validPassword = true;
        error_log("Plain text password login for: {$username}, type: {$user['type']}");
    } 
    // 检查加密密码
    elseif (password_verify($password, $user['password'])) {
        $validPassword = true;
        error_log("Hashed password login for: {$username}, type: {$user['type']}");
    }
    // 如果都不匹配，记录调试信息
    else {
        error_log("Password mismatch for user: {$username}, provided: {$password}, stored: " . substr($user['password'], 0, 20) . "...");
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
            'real_name' => $user['real_name']
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
    
    return [
        'success' => true,
        'user' => [
            'id' => $_SESSION['user_id'],
            'username' => $_SESSION['username'],
            'type' => $_SESSION['user_type'],
            'real_name' => $_SESSION['real_name']
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