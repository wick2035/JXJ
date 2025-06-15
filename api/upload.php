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

session_start();

// 安全地包含配置文件
if (!file_exists('../config.php')) {
    echo json_encode(['success' => false, 'message' => '系统配置文件不存在']);
    exit;
}
require_once '../config.php';

if (!file_exists('auth-functions.php')) {
    echo json_encode(['success' => false, 'message' => '认证模块不存在']);
    exit;
}
require_once 'auth-functions.php';

// 检查登录状态
$loginResult = checkLogin();
if (!$loginResult['success']) {
    echo json_encode(['success' => false, 'message' => '请先登录系统', 'error_type' => 'auth']);
    exit;
}

// 文件上传处理
function uploadFiles($files) {
    // 确保常量已定义
    if (!defined('UPLOAD_PATH')) {
        return ['success' => false, 'message' => '上传路径未配置'];
    }
    
    $uploadDir = '../' . UPLOAD_PATH;
    
    // 确保上传目录存在
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    $uploadedFiles = [];
    
    // 处理单个文件或多个文件
    if (is_array($files['tmp_name'])) {
        // 多个文件
        foreach ($files['tmp_name'] as $key => $tmpName) {
            if ($files['error'][$key] !== UPLOAD_ERR_OK) {
                continue;
            }
            
            $originalName = $files['name'][$key];
            $fileSize = $files['size'][$key];
            $fileType = $files['type'][$key];
            
            $result = processFile($tmpName, $originalName, $fileSize, $fileType, $uploadDir);
            if (!$result['success']) {
                return $result;
            }
            $uploadedFiles[] = $result['data'];
        }
    } else {
        // 单个文件
        if ($files['error'] !== UPLOAD_ERR_OK) {
            return ['success' => false, 'message' => '文件上传出错'];
        }
        
        $result = processFile($files['tmp_name'], $files['name'], $files['size'], $files['type'], $uploadDir);
        if (!$result['success']) {
            return $result;
        }
        $uploadedFiles[] = $result['data'];
    }
    
    return ['success' => true, 'data' => $uploadedFiles];
}

// 处理单个文件
function processFile($tmpName, $originalName, $fileSize, $fileType, $uploadDir) {
    // 检查文件大小
    $maxSize = defined('MAX_FILE_SIZE') ? MAX_FILE_SIZE : (10 * 1024 * 1024); // 默认10MB
    if ($fileSize > $maxSize) {
        return ['success' => false, 'message' => "文件 {$originalName} 超过大小限制"];
    }
    
    // 检查文件类型
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!in_array($fileType, $allowedTypes)) {
        return ['success' => false, 'message' => "文件 {$originalName} 类型不支持"];
    }
    
    // 生成唯一文件名
    $extension = pathinfo($originalName, PATHINFO_EXTENSION);
    $fileName = time() . '_' . uniqid() . '.' . $extension;
    $filePath = $uploadDir . $fileName;
    
    // 移动文件
    if (move_uploaded_file($tmpName, $filePath)) {
        return [
            'success' => true,
            'data' => [
                'original_name' => $originalName,
                'file_name' => $fileName,
                'file_path' => (defined('UPLOAD_PATH') ? UPLOAD_PATH : 'uploads/') . $fileName,
                'file_size' => $fileSize,
                'file_type' => $fileType,
                'url' => (defined('UPLOAD_PATH') ? UPLOAD_PATH : 'uploads/') . $fileName
            ]
        ];
    } else {
        return ['success' => false, 'message' => "文件 {$originalName} 上传失败"];
    }
}

// 处理文件下载/预览
function serveFile($filePath) {
    $fullPath = '../' . $filePath;
    
    if (!file_exists($fullPath)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => '文件不存在']);
        return;
    }
    
    $fileInfo = pathinfo($fullPath);
    $mimeType = mime_content_type($fullPath);
    
    header('Content-Type: ' . $mimeType);
    header('Content-Length: ' . filesize($fullPath));
    
    // 如果是图片或PDF，设置为内联显示；否则设置为下载
    if (strpos($mimeType, 'image/') === 0 || $mimeType === 'application/pdf') {
        header('Content-Disposition: inline; filename="' . $fileInfo['basename'] . '"');
    } else {
        header('Content-Disposition: attachment; filename="' . $fileInfo['basename'] . '"');
    }
    
    readfile($fullPath);
}

// 处理请求
$action = $_GET['action'] ?? $_POST['action'] ?? '';

// 调试信息
error_log('Upload API called with action: ' . $action);
error_log('GET params: ' . print_r($_GET, true));
error_log('POST params: ' . print_r($_POST, true));
error_log('FILES: ' . print_r($_FILES, true));
error_log('REQUEST_METHOD: ' . $_SERVER['REQUEST_METHOD']);
error_log('CONTENT_TYPE: ' . ($_SERVER['CONTENT_TYPE'] ?? 'not set'));

// 如果action为空，尝试从其他地方获取
if (empty($action)) {
    // 检查是否有文件上传，如果有则默认为upload操作
    if (!empty($_FILES)) {
        $action = 'upload';
        error_log('Action was empty, but files detected, setting action to upload');
    }
}

try {
    switch ($action) {
        case 'upload':
            // 检查是否有文件上传
            $files = null;
            
            // 调试：输出所有接收到的文件信息
            error_log('Received FILES: ' . print_r($_FILES, true));
            
            if (isset($_FILES['files'])) {
                $files = $_FILES['files'];
            } elseif (isset($_FILES['files[]'])) {
                $files = $_FILES['files[]']; 
            } else {
                // 检查所有可能的文件字段，包括数组形式的字段名
                foreach ($_FILES as $key => $file) {
                    if (is_array($file['error'])) {
                        // 处理多文件数组
                        if ($file['error'][0] === UPLOAD_ERR_OK) {
                            $files = $file;
                            break;
                        }
                    } else {
                        // 处理单个文件
                        if ($file['error'] === UPLOAD_ERR_OK) {
                            $files = $file;
                            break;
                        }
                    }
                }
            }
            
            if (!$files) {
                echo json_encode(['success' => false, 'message' => '没有上传文件', 'debug' => $_FILES]);
                break;
            }
            
            $result = uploadFiles($files);
            echo json_encode($result);
            break;
            
        case 'serve':
            $filePath = $_GET['path'] ?? '';
            if (empty($filePath)) {
                echo json_encode(['success' => false, 'message' => '文件路径不能为空']);
                break;
            }
            
            serveFile($filePath);
            break;
            
        default:
            error_log('Unknown action received: ' . $action);
            echo json_encode([
                'success' => false, 
                'message' => '未知操作: ' . $action,
                'debug' => [
                    'action' => $action,
                    'get' => $_GET,
                    'post' => $_POST,
                    'files_count' => count($_FILES)
                ]
            ]);
            break;
    }
} catch (Exception $e) {
    error_log('Upload API Exception: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    echo json_encode(['success' => false, 'message' => '服务器内部错误: ' . $e->getMessage()]);
} catch (Error $e) {
    error_log('Upload API Fatal Error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    echo json_encode(['success' => false, 'message' => '服务器致命错误: ' . $e->getMessage()]);
}
?> 