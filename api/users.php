<?php
// 清空输出缓冲区并设置正确的响应头
ob_clean();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// 处理预检请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// 抑制错误输出，避免污染JSON响应
error_reporting(0);
ini_set('display_errors', 0);

session_start();

// 检查config.php是否存在
if (!file_exists('../config.php')) {
    echo json_encode(['success' => false, 'message' => '系统配置文件不存在，请重新安装系统']);
    exit;
}

require_once '../config.php';
require_once 'auth-functions.php';

// 检查管理员权限
function checkAdminAuth() {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        // 返回错误而不是直接退出，让调用者处理
        return $authResult;
    }
    return ['success' => true];
}

// 获取数据库连接
function getConnection() {
    try {
        // 检查数据库配置常量是否存在
        if (!defined('DB_HOST') || !defined('DB_NAME') || !defined('DB_USER') || !defined('DB_PASS')) {
            throw new Exception('数据库配置不完整');
        }
        
        $port = defined('DB_PORT') ? DB_PORT : 3306;
        $dsn = "mysql:host=" . DB_HOST . ";port=" . $port . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $pdo = new PDO($dsn, DB_USER, DB_PASS);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        return $pdo;
    } catch (PDOException $e) {
        error_log('Database connection error: ' . $e->getMessage());
        throw new Exception('数据库连接失败: ' . $e->getMessage());
    }
}

// 获取用户列表
function getUserList() {
    $authResult = checkAdminAuth();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    $stmt = $pdo->prepare("SELECT id, username, type, real_name, email, phone, student_id, class, major, created_at FROM users ORDER BY created_at DESC");
    $stmt->execute();
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    return ['success' => true, 'users' => $users];
}

// 添加用户
function addUser($data) {
    $authResult = checkAdminAuth();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    // 检查用户名是否已存在
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->execute([$data['username']]);
    if ($stmt->fetch()) {
        return ['success' => false, 'message' => '用户名已存在'];
    }
    
    // 密码加密
    $hashedPassword = password_hash($data['password'], PASSWORD_DEFAULT);
    
    $stmt = $pdo->prepare("INSERT INTO users (username, password, type, real_name, email, phone, student_id, class, major) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $success = $stmt->execute([
        $data['username'],
        $hashedPassword,
        $data['type'],
        $data['real_name'] ?? null,
        $data['email'] ?? null,
        $data['phone'] ?? null,
        $data['student_id'] ?? null,
        $data['class'] ?? null,
        $data['major'] ?? null
    ]);
    
    if ($success) {
        $insertedId = $pdo->lastInsertId();
        error_log("User added successfully: ID={$insertedId}, username={$data['username']}, type={$data['type']}");
        return ['success' => true, 'message' => '用户添加成功', 'user_id' => $insertedId];
    } else {
        error_log("Failed to insert user: " . print_r($stmt->errorInfo(), true));
        return ['success' => false, 'message' => '数据插入失败'];
    }
}

// 更新用户
function updateUser($id, $data) {
    $authResult = checkAdminAuth();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    // 检查用户是否存在
    $stmt = $pdo->prepare("SELECT id FROM users WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        return ['success' => false, 'message' => '用户不存在'];
    }
    
    // 如果要更新用户名，检查是否已存在
    if (!empty($data['username'])) {
        $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? AND id != ?");
        $stmt->execute([$data['username'], $id]);
        if ($stmt->fetch()) {
            return ['success' => false, 'message' => '用户名已存在'];
        }
    }
    
    // 构建更新SQL
    $updateFields = [];
    $params = [];
    
    if (!empty($data['username'])) {
        $updateFields[] = "username = ?";
        $params[] = $data['username'];
    }
    
    if (!empty($data['password'])) {
        $updateFields[] = "password = ?";
        $params[] = password_hash($data['password'], PASSWORD_DEFAULT);
    }
    
    if (!empty($data['type'])) {
        $updateFields[] = "type = ?";
        $params[] = $data['type'];
    }
    
    if (isset($data['real_name'])) {
        $updateFields[] = "real_name = ?";
        $params[] = $data['real_name'];
    }
    
    if (isset($data['email'])) {
        $updateFields[] = "email = ?";
        $params[] = $data['email'];
    }
    
    if (isset($data['phone'])) {
        $updateFields[] = "phone = ?";
        $params[] = $data['phone'];
    }
    
    if (isset($data['student_id'])) {
        $updateFields[] = "student_id = ?";
        $params[] = $data['student_id'];
    }
    
    if (isset($data['class'])) {
        $updateFields[] = "class = ?";
        $params[] = $data['class'];
    }
    
    if (isset($data['major'])) {
        $updateFields[] = "major = ?";
        $params[] = $data['major'];
    }
    
    if (empty($updateFields)) {
        return ['success' => false, 'message' => '没有要更新的字段'];
    }
    
    $updateFields[] = "updated_at = CURRENT_TIMESTAMP";
    $params[] = $id;
    
    $sql = "UPDATE users SET " . implode(', ', $updateFields) . " WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    
    return ['success' => true, 'message' => '用户更新成功'];
}

// 删除用户
function deleteUser($id) {
    $authResult = checkAdminAuth();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    // 检查用户是否存在
    $stmt = $pdo->prepare("SELECT id FROM users WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        return ['success' => false, 'message' => '用户不存在'];
    }
    
    // 删除用户（由于外键约束，相关的申请记录也会被删除）
    $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
    $stmt->execute([$id]);
    
    return ['success' => true, 'message' => '用户删除成功'];
}

// 处理请求
try {
    $action = $_GET['action'] ?? $_POST['action'] ?? '';
    
    // 调试信息
    error_log('Users API called with action: ' . $action);
    error_log('Session data: ' . print_r($_SESSION, true));
    
    switch ($action) {
        case 'list':
            $result = getUserList();
            echo json_encode($result);
            break;
            
        case 'add':
            $data = [
                'username' => $_POST['username'] ?? '',
                'password' => $_POST['password'] ?? '',
                'type' => $_POST['type'] ?? '',
                'real_name' => $_POST['real_name'] ?? null,
                'email' => $_POST['email'] ?? null,
                'phone' => $_POST['phone'] ?? null,
                'student_id' => $_POST['student_id'] ?? null,
                'class' => $_POST['class'] ?? null,
                'major' => $_POST['major'] ?? null
            ];
            
            // 调试信息
            error_log("Add user request data: " . print_r($data, true));
            error_log("Current session: " . print_r($_SESSION, true));
            
            if (empty($data['username']) || empty($data['password']) || empty($data['type'])) {
                echo json_encode(['success' => false, 'message' => '用户名、密码和用户类型不能为空']);
                break;
            }
            
            $result = addUser($data);
            error_log("Add user result: " . print_r($result, true));
            echo json_encode($result);
            break;
            
        case 'update':
            $id = $_POST['id'] ?? $_GET['id'] ?? '';
            if (empty($id)) {
                echo json_encode(['success' => false, 'message' => '用户ID不能为空']);
                break;
            }
            
            $data = [
                'username' => $_POST['username'] ?? null,
                'password' => $_POST['password'] ?? null,
                'type' => $_POST['type'] ?? null,
                'real_name' => $_POST['real_name'] ?? null,
                'email' => $_POST['email'] ?? null,
                'phone' => $_POST['phone'] ?? null,
                'student_id' => $_POST['student_id'] ?? null,
                'class' => $_POST['class'] ?? null,
                'major' => $_POST['major'] ?? null
            ];
            
            $result = updateUser($id, $data);
            echo json_encode($result);
            break;
            
        case 'delete':
            $id = $_POST['id'] ?? $_GET['id'] ?? '';
            if (empty($id)) {
                echo json_encode(['success' => false, 'message' => '用户ID不能为空']);
                break;
            }
            
            $result = deleteUser($id);
            echo json_encode($result);
            break;
            
        default:
            echo json_encode(['success' => false, 'message' => '未知操作']);
            break;
    }
} catch (Exception $e) {
    error_log('Users API error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    echo json_encode(['success' => false, 'message' => $e->getMessage(), 'error_type' => 'exception']);
}
?> 