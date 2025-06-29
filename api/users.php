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

// 启用错误输出用于调试
error_reporting(E_ALL);
ini_set('display_errors', 1);

session_start();

// 调试会话信息
error_log('Users API - Session started');
error_log('Session ID: ' . session_id());
error_log('Session data: ' . print_r($_SESSION, true));

// 检查config.php是否存在
if (!file_exists('../config.php')) {
    error_log('Config file not found');
    echo json_encode(['success' => false, 'message' => '系统配置文件不存在，请重新安装系统']);
    exit;
}

require_once '../config.php';

// 检查auth-functions.php是否存在
if (!file_exists('auth-functions.php')) {
    error_log('Auth functions file not found');
    echo json_encode(['success' => false, 'message' => '认证模块不存在']);
    exit;
}

require_once 'auth-functions.php';

// 调试数据库常量
error_log('DB_HOST: ' . (defined('DB_HOST') ? DB_HOST : 'undefined'));
error_log('DB_NAME: ' . (defined('DB_NAME') ? DB_NAME : 'undefined'));

// 获取用户列表
function getUserList() {
    $authResult = requireAdmin();
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
    $authResult = requireAdmin();
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
    $authResult = requireAdmin();
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
    $authResult = requireAdmin();
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

// 批量导入用户
function batchImportUsers($filePath) {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    // 检查文件是否存在
    if (!file_exists($filePath)) {
        return ['success' => false, 'message' => '文件不存在'];
    }
    
    // 读取CSV文件
    $csvData = [];
    $handle = fopen($filePath, 'r');
    if ($handle === FALSE) {
        return ['success' => false, 'message' => '无法读取文件'];
    }
    
    // 读取表头
    $headers = fgetcsv($handle);
    if ($headers === FALSE) {
        fclose($handle);
        return ['success' => false, 'message' => '文件格式错误'];
    }
    
    // 验证表头格式
    $expectedHeaders = ['用户名', '密码', '用户类型', '真实姓名', '邮箱', '手机号', '学号', '班级', '专业'];
    if (count($headers) < 3 || trim($headers[0]) !== '用户名' || trim($headers[1]) !== '密码' || trim($headers[2]) !== '用户类型') {
        fclose($handle);
        return ['success' => false, 'message' => '文件格式错误，请确保前三列为：用户名、密码、用户类型'];
    }
    
    // 读取数据行
    $lineNumber = 1;
    $successCount = 0;
    $errorCount = 0;
    $errors = [];
    
    while (($row = fgetcsv($handle)) !== FALSE) {
        $lineNumber++;
        
        // 跳过空行
        if (empty(array_filter($row))) {
            continue;
        }
        
        // 确保至少有基本字段
        if (count($row) < 3) {
            $errors[] = "第{$lineNumber}行：数据不完整";
            $errorCount++;
            continue;
        }
        
        $userData = [
            'username' => trim($row[0]),
            'password' => trim($row[1]),
            'type' => trim($row[2]),
            'real_name' => isset($row[3]) ? trim($row[3]) : null,
            'email' => isset($row[4]) ? trim($row[4]) : null,
            'phone' => isset($row[5]) ? trim($row[5]) : null,
            'student_id' => isset($row[6]) ? trim($row[6]) : null,
            'class' => isset($row[7]) ? trim($row[7]) : null,
            'major' => isset($row[8]) ? trim($row[8]) : null
        ];
        
        // 验证必填字段
        if (empty($userData['username']) || empty($userData['password']) || empty($userData['type'])) {
            $errors[] = "第{$lineNumber}行：用户名、密码、用户类型不能为空";
            $errorCount++;
            continue;
        }
        
        // 验证用户类型
        if (!in_array($userData['type'], ['student', 'admin'])) {
            $errors[] = "第{$lineNumber}行：用户类型必须为student或admin";
            $errorCount++;
            continue;
        }
        
        // 验证邮箱格式
        if (!empty($userData['email']) && !filter_var($userData['email'], FILTER_VALIDATE_EMAIL)) {
            $errors[] = "第{$lineNumber}行：邮箱格式不正确";
            $errorCount++;
            continue;
        }
        
        // 尝试添加用户
        $result = addUser($userData);
        if ($result['success']) {
            $successCount++;
        } else {
            $errors[] = "第{$lineNumber}行：{$result['message']}";
            $errorCount++;
        }
    }
    
    fclose($handle);
    
    // 删除临时文件
    unlink($filePath);
    
    $message = "导入完成：成功{$successCount}条，失败{$errorCount}条";
    if ($errorCount > 0) {
        $message .= "。错误详情：\n" . implode("\n", array_slice($errors, 0, 10));
        if (count($errors) > 10) {
            $message .= "\n...（省略其他错误）";
        }
    }
    
    return [
        'success' => true,
        'message' => $message,
        'total' => $successCount + $errorCount,
        'success_count' => $successCount,
        'error_count' => $errorCount,
        'errors' => $errors
    ];
}

// 处理请求
try {
    // 处理JSON请求体
    $json_input = file_get_contents('php://input');
    $json_data = [];
    if (!empty($json_input)) {
        $json_data = json_decode($json_input, true) ?? [];
        error_log('JSON input: ' . $json_input);
        error_log('JSON data: ' . print_r($json_data, true));
    }
    
    $action = $_GET['action'] ?? $_POST['action'] ?? $json_data['action'] ?? '';
    
    // 调试信息
    error_log('Users API called with action: ' . $action);
    error_log('GET data: ' . print_r($_GET, true));
    error_log('POST data: ' . print_r($_POST, true));
    error_log('JSON data: ' . print_r($json_data, true));
    error_log('Session data: ' . print_r($_SESSION, true));
    
    switch ($action) {
        case 'list':
            $result = getUserList();
            echo json_encode($result);
            break;
            
        case 'add':
            // 合并POST和JSON数据
            $all_data = array_merge($_POST, $json_data);
            $data = [
                'username' => $all_data['username'] ?? '',
                'password' => $all_data['password'] ?? '',
                'type' => $all_data['type'] ?? '',
                'real_name' => $all_data['real_name'] ?? null,
                'email' => $all_data['email'] ?? null,
                'phone' => $all_data['phone'] ?? null,
                'student_id' => $all_data['student_id'] ?? null,
                'class' => $all_data['class'] ?? null,
                'major' => $all_data['major'] ?? null
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
            // 合并所有数据源
            $all_data = array_merge($_POST, $_GET, $json_data);
            $id = $all_data['id'] ?? '';
            if (empty($id)) {
                echo json_encode(['success' => false, 'message' => '用户ID不能为空']);
                break;
            }
            
            $data = [
                'username' => $all_data['username'] ?? null,
                'password' => $all_data['password'] ?? null,
                'type' => $all_data['type'] ?? null,
                'real_name' => $all_data['real_name'] ?? null,
                'email' => $all_data['email'] ?? null,
                'phone' => $all_data['phone'] ?? null,
                'student_id' => $all_data['student_id'] ?? null,
                'class' => $all_data['class'] ?? null,
                'major' => $all_data['major'] ?? null
            ];
            
            $result = updateUser($id, $data);
            echo json_encode($result);
            break;
            
        case 'delete':
            // 合并所有数据源
            $all_data = array_merge($_POST, $_GET, $json_data);
            $id = $all_data['id'] ?? '';
            if (empty($id)) {
                echo json_encode(['success' => false, 'message' => '用户ID不能为空']);
                break;
            }
            
            $result = deleteUser($id);
            echo json_encode($result);
            break;
            
        case 'batch_import':
            // 处理文件上传
            if (!isset($_FILES['import_file']) || $_FILES['import_file']['error'] !== UPLOAD_ERR_OK) {
                echo json_encode(['success' => false, 'message' => '请选择要导入的CSV文件']);
                break;
            }
            
            $uploadedFile = $_FILES['import_file'];
            
            // 验证文件类型
            $fileExtension = strtolower(pathinfo($uploadedFile['name'], PATHINFO_EXTENSION));
            if (!in_array($fileExtension, ['csv'])) {
                echo json_encode(['success' => false, 'message' => '只支持CSV格式文件']);
                break;
            }
            
            // 验证文件大小（最大5MB）
            if ($uploadedFile['size'] > 5 * 1024 * 1024) {
                echo json_encode(['success' => false, 'message' => '文件大小不能超过5MB']);
                break;
            }
            
            // 移动文件到临时目录
            $tempDir = '../uploads/temp/';
            if (!is_dir($tempDir)) {
                mkdir($tempDir, 0755, true);
            }
            
            $tempFileName = $tempDir . 'import_' . time() . '_' . uniqid() . '.csv';
            if (!move_uploaded_file($uploadedFile['tmp_name'], $tempFileName)) {
                echo json_encode(['success' => false, 'message' => '文件上传失败']);
                break;
            }
            
            // 执行批量导入
            $result = batchImportUsers($tempFileName);
            echo json_encode($result);
            break;
            
        case 'download_template':
            // 下载模板文件
            $templatePath = '../excel/用户批量导入模板.csv';
            if (!file_exists($templatePath)) {
                echo json_encode(['success' => false, 'message' => '模板文件不存在']);
                break;
            }
            
            // 设置下载头
            header('Content-Type: text/csv; charset=UTF-8');
            header('Content-Disposition: attachment; filename="用户批量导入模板.csv"');
            header('Content-Length: ' . filesize($templatePath));
            
            // 输出BOM以支持Excel正确显示中文
            echo "\xEF\xBB\xBF";
            readfile($templatePath);
            exit;
            break;
            
        default:
            echo json_encode(['success' => false, 'message' => '未知操作: ' . $action]);
            break;
    }
} catch (Exception $e) {
    error_log('Users API error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    echo json_encode(['success' => false, 'message' => $e->getMessage(), 'error_type' => 'exception']);
}
?> 