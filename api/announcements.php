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
require_once '../config.php';
require_once 'auth-functions.php';

// 获取公告列表
function getAnnouncements($activeOnly = false) {
    $pdo = getConnection();
    
    $sql = "SELECT a.*, u.real_name as creator_name 
            FROM announcements a 
            LEFT JOIN users u ON a.created_by = u.id";
    
    if ($activeOnly) {
        $sql .= " WHERE a.is_active = 1";
    }
    
    $sql .= " ORDER BY a.publish_time DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $announcements = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    return ['success' => true, 'data' => $announcements];
}

// 获取当前活跃公告
function getActiveAnnouncement() {
    $pdo = getConnection();
    
    $stmt = $pdo->prepare("SELECT * FROM announcements WHERE is_active = 1 ORDER BY publish_time DESC LIMIT 1");
    $stmt->execute();
    $announcement = $stmt->fetch(PDO::FETCH_ASSOC);
    
    return ['success' => true, 'data' => $announcement];
}

// 创建公告
function createAnnouncement($title, $content, $type) {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    // 如果是重要或紧急公告，将其他公告设为非活跃
    if (in_array($type, ['important', 'urgent'])) {
        $pdo->exec("UPDATE announcements SET is_active = 0");
    }
    
    $stmt = $pdo->prepare("INSERT INTO announcements (title, content, type, is_active, created_by) VALUES (?, ?, ?, ?, ?)");
    $isActive = in_array($type, ['important', 'urgent']) ? 1 : 0;
    $stmt->execute([$title, $content, $type, $isActive, $_SESSION['user_id']]);
    
    return ['success' => true, 'message' => '公告发布成功', 'id' => $pdo->lastInsertId()];
}

// 设置活跃公告
function setActiveAnnouncement($id) {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    // 将所有公告设为非活跃
    $pdo->exec("UPDATE announcements SET is_active = 0");
    
    // 设置指定公告为活跃
    $stmt = $pdo->prepare("UPDATE announcements SET is_active = 1 WHERE id = ?");
    $stmt->execute([$id]);
    
    return ['success' => true, 'message' => '设置成功'];
}

// 删除公告
function deleteAnnouncement($id) {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    $stmt = $pdo->prepare("DELETE FROM announcements WHERE id = ?");
    $stmt->execute([$id]);
    
    return ['success' => true, 'message' => '删除成功'];
}

// 处理请求
try {
    $action = $_GET['action'] ?? $_POST['action'] ?? '';
    
    switch ($action) {
        case 'list':
            $activeOnly = isset($_GET['active_only']) && $_GET['active_only'] === 'true';
            $result = getAnnouncements($activeOnly);
            echo json_encode(['success' => true, 'announcements' => $result['data']]);
            break;
            
        case 'active':
            $result = getActiveAnnouncement();
            echo json_encode($result);
            break;
            
        case 'create':
            $title = $_POST['title'] ?? '';
            $content = $_POST['content'] ?? '';
            $type = $_POST['type'] ?? 'normal';
            
            if (empty($title) || empty($content)) {
                echo json_encode(['success' => false, 'message' => '标题和内容不能为空']);
                break;
            }
            
            $result = createAnnouncement($title, $content, $type);
            echo json_encode($result);
            break;
            
        case 'set_active':
            $id = $_POST['id'] ?? 0;
            if (!$id) {
                echo json_encode(['success' => false, 'message' => '公告ID不能为空']);
                break;
            }
            
            $result = setActiveAnnouncement($id);
            echo json_encode($result);
            break;
            
        case 'delete':
            $id = $_POST['id'] ?? 0;
            if (!$id) {
                echo json_encode(['success' => false, 'message' => '公告ID不能为空']);
                break;
            }
            
            $result = deleteAnnouncement($id);
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