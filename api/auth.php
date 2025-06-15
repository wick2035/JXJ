<?php
// 清空输出缓冲区并设置正确的响应头
ob_clean();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
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

// 处理请求
try {
    $action = $_GET['action'] ?? $_POST['action'] ?? '';
    
    switch ($action) {
        case 'login':
            $username = $_POST['username'] ?? '';
            $password = $_POST['password'] ?? '';
            
            if (empty($username) || empty($password)) {
                echo json_encode(['success' => false, 'message' => '用户名和密码不能为空']);
                break;
            }
            
            $result = login($username, $password);
            echo json_encode($result);
            break;
            
        case 'logout':
            $result = logout();
            echo json_encode($result);
            break;
            
        case 'check':
            $result = checkLogin();
            echo json_encode($result);
            break;
            
        default:
            echo json_encode(['success' => false, 'message' => '未知操作']);
            break;
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?> 