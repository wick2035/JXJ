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

// 获取批次列表
function getBatches() {
    $pdo = getConnection();
    
    $stmt = $pdo->prepare("SELECT * FROM batches ORDER BY id DESC");
    $stmt->execute();
    $batches = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    return ['success' => true, 'data' => $batches];
}

// 获取用户申请列表
function getUserApplications($userId) {
    $pdo = getConnection();
    
    $stmt = $pdo->prepare("
        SELECT a.*, b.name as batch_name 
        FROM applications a 
        LEFT JOIN batches b ON a.batch_id = b.id 
        WHERE a.user_id = ? 
        ORDER BY a.submitted_at DESC
    ");
    $stmt->execute([$userId]);
    $applications = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    return ['success' => true, 'data' => $applications];
}

// 获取申请详情
function getApplicationDetail($id, $userId = null) {
    $pdo = getConnection();
    
    $sql = "
        SELECT a.*, b.name as batch_name, u.real_name as user_name
        FROM applications a 
        LEFT JOIN batches b ON a.batch_id = b.id 
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.id = ?
    ";
    
    if ($userId) {
        $sql .= " AND a.user_id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$id, $userId]);
    } else {
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$id]);
    }
    
    $application = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$application) {
        return ['success' => false, 'message' => '申请不存在'];
    }
    
    // 获取申请材料
    $stmt = $pdo->prepare("
        SELECT am.*, c.name as category_name, i.name as item_name 
        FROM application_materials am
        LEFT JOIN categories c ON am.category_id = c.id
        LEFT JOIN items i ON am.item_id = i.id
        WHERE am.application_id = ?
    ");
    $stmt->execute([$id]);
    $materials = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 获取每个材料的文件
    foreach ($materials as &$material) {
        $stmt = $pdo->prepare("SELECT * FROM uploaded_files WHERE material_id = ?");
        $stmt->execute([$material['id']]);
        $material['files'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    $application['materials'] = $materials;
    
    return ['success' => true, 'data' => $application];
}

// 获取所有申请（管理员）
function getAllApplications() {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    $stmt = $pdo->prepare("
        SELECT a.*, b.name as batch_name, u.real_name as user_name
        FROM applications a 
        LEFT JOIN batches b ON a.batch_id = b.id 
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.submitted_at DESC
    ");
    $stmt->execute();
    $applications = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 获取每个申请的材料统计
    foreach ($applications as &$application) {
        $stmt = $pdo->prepare("SELECT COUNT(*) as material_count FROM application_materials WHERE application_id = ?");
        $stmt->execute([$application['id']]);
        $application['material_count'] = $stmt->fetchColumn();
    }
    
    return ['success' => true, 'data' => $applications];
}

// 创建或更新申请
function saveApplication($userId, $batchId, $materials) {
    $pdo = getConnection();
    
    // 调试信息
    error_log("saveApplication called with userId: $userId, batchId: $batchId");
    error_log("Materials data: " . print_r($materials, true));
    
    try {
        $pdo->beginTransaction();
        
        // 检查是否已存在申请
        $stmt = $pdo->prepare("SELECT id FROM applications WHERE user_id = ? AND batch_id = ?");
        $stmt->execute([$userId, $batchId]);
        $existingApp = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($existingApp) {
            $applicationId = $existingApp['id'];
            // 删除旧的材料数据
            $stmt = $pdo->prepare("DELETE FROM application_materials WHERE application_id = ?");
            $stmt->execute([$applicationId]);
        } else {
            // 创建新申请
            $stmt = $pdo->prepare("INSERT INTO applications (user_id, batch_id, status) VALUES (?, ?, 'pending')");
            $stmt->execute([$userId, $batchId]);
            $applicationId = $pdo->lastInsertId();
        }
        
        $totalScore = 0;
        
        // 保存材料数据
        foreach ($materials as $material) {
            // 确保score不为null
            $score = isset($material['score']) ? (int)$material['score'] : 0;
            
            $stmt = $pdo->prepare("
                INSERT INTO application_materials 
                (application_id, category_id, item_id, award_level, award_grade, score) 
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $applicationId,
                $material['category_id'],
                $material['item_id'],
                $material['award_level'],
                $material['award_grade'],
                $score
            ]);
            $materialId = $pdo->lastInsertId();
            
            $totalScore += $score;
            
            // 保存文件数据
            if (isset($material['files'])) {
                foreach ($material['files'] as $file) {
                    // 确保文件数据完整
                    $originalName = $file['original_name'] ?? $file['name'] ?? '未知文件';
                    $fileName = $file['file_name'] ?? $file['path'] ?? '';
                    $filePath = $file['file_path'] ?? $file['path'] ?? '';
                    $fileSize = $file['file_size'] ?? $file['size'] ?? 0;
                    $fileType = $file['file_type'] ?? $file['type'] ?? '';
                    
                    error_log("Saving file: originalName=$originalName, fileName=$fileName, filePath=$filePath");
                    
                    $stmt = $pdo->prepare("
                        INSERT INTO uploaded_files 
                        (material_id, original_name, file_name, file_path, file_size, file_type) 
                        VALUES (?, ?, ?, ?, ?, ?)
                    ");
                    $stmt->execute([
                        $materialId,
                        $originalName,
                        $fileName,
                        $filePath,
                        $fileSize,
                        $fileType
                    ]);
                }
            }
        }
        
        // 更新总分
        $stmt = $pdo->prepare("UPDATE applications SET total_score = ?, submitted_at = NOW() WHERE id = ?");
        $stmt->execute([$totalScore, $applicationId]);
        
        $pdo->commit();
        
        return ['success' => true, 'message' => '申请保存成功', 'id' => $applicationId];
    } catch (Exception $e) {
        $pdo->rollBack();
        return ['success' => false, 'message' => '保存失败: ' . $e->getMessage()];
    }
}

// 审核申请
function reviewApplication($id, $status, $comment, $reviewerId) {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    $stmt = $pdo->prepare("
        UPDATE applications 
        SET status = ?, review_comment = ?, reviewed_by = ?, reviewed_at = NOW() 
        WHERE id = ?
    ");
    $stmt->execute([$status, $comment, $reviewerId, $id]);
    
    return ['success' => true, 'message' => '审核完成'];
}

// 获取统计数据
function getStats() {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    $stats = [];
    
    // 申请总数
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM applications");
    $stmt->execute();
    $stats['total_applications'] = $stmt->fetchColumn();
    
    // 待审核申请数
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM applications WHERE status = 'pending'");
    $stmt->execute();
    $stats['pending_applications'] = $stmt->fetchColumn();
    
    // 类目总数
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM categories");
    $stmt->execute();
    $stats['total_categories'] = $stmt->fetchColumn();
    
    // 奖项总数
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM items");
    $stmt->execute();
    $stats['total_items'] = $stmt->fetchColumn();
    
    return ['success' => true, 'data' => $stats];
}

// 处理请求
try {
    $action = $_GET['action'] ?? $_POST['action'] ?? '';
    
    // 如果action为空，尝试从JSON请求体获取
    if (empty($action)) {
        $inputData = file_get_contents('php://input');
        $requestData = json_decode($inputData, true);
        if ($requestData && isset($requestData['action'])) {
            $action = $requestData['action'];
        }
    }
    
    error_log("Applications API called with action: $action");
    error_log("Request method: " . $_SERVER['REQUEST_METHOD']);
    error_log("Content type: " . ($_SERVER['CONTENT_TYPE'] ?? 'not set'));
    
    switch ($action) {
        case 'getBatches':
        case 'get_batches':
            $result = getBatches();
            echo json_encode(['success' => true, 'batches' => $result['data']]);
            break;
            
        case 'get_user_applications':
            $loginResult = checkLogin();
            if (!$loginResult['success']) {
                echo json_encode($loginResult);
                break;
            }
            
            $result = getUserApplications($_SESSION['user_id']);
            echo json_encode($result);
            break;
            
        case 'get_detail':
            $id = $_GET['id'] ?? 0;
            if (!$id) {
                echo json_encode(['success' => false, 'message' => '申请ID不能为空']);
                break;
            }
            
            $loginResult = checkLogin();
            if (!$loginResult['success']) {
                echo json_encode($loginResult);
                break;
            }
            
            // 学生只能查看自己的申请，管理员可以查看所有申请
            $userId = $_SESSION['user_type'] === 'student' ? $_SESSION['user_id'] : null;
            $result = getApplicationDetail($id, $userId);
            echo json_encode($result);
            break;
            
        case 'get_all':
            $result = getAllApplications();
            echo json_encode($result);
            break;
            
        case 'save':
        case 'submitApplication':
        case 'updateApplication':
            $loginResult = checkLogin();
            if (!$loginResult['success']) {
                echo json_encode($loginResult);
                break;
            }
            
            // 处理JSON请求体
            $inputData = file_get_contents('php://input');
            $requestData = json_decode($inputData, true);
            
            if ($requestData) {
                $batchId = $requestData['batch_id'] ?? 0;
                $materials = $requestData['materials'] ?? [];
            } else {
                $batchId = $_POST['batch_id'] ?? 0;
                $materials = json_decode($_POST['materials'] ?? '[]', true);
            }
            
            error_log("Request action: $action");
            error_log("Batch ID: $batchId");
            error_log("Materials count: " . count($materials));
            
            if (!$batchId || empty($materials)) {
                echo json_encode(['success' => false, 'message' => '参数不完整: batch_id=' . $batchId . ', materials=' . count($materials)]);
                break;
            }
            
            $result = saveApplication($_SESSION['user_id'], $batchId, $materials);
            echo json_encode($result);
            break;
            
        case 'review':
            $id = $_POST['id'] ?? 0;
            $status = $_POST['status'] ?? '';
            $comment = $_POST['comment'] ?? '';
            
            if (!$id || !$status) {
                echo json_encode(['success' => false, 'message' => '参数不完整']);
                break;
            }
            
            $loginResult = checkLogin();
            if (!$loginResult['success']) {
                echo json_encode($loginResult);
                break;
            }
            
            $result = reviewApplication($id, $status, $comment, $_SESSION['user_id']);
            echo json_encode($result);
            break;
            
        case 'stats':
            $result = getStats();
            echo json_encode($result);
            break;
            
        default:
            error_log("Unknown action in applications.php: '$action'");
            echo json_encode([
                'success' => false, 
                'message' => '未知操作: ' . $action,
                'debug' => [
                    'action' => $action,
                    'get' => $_GET,
                    'post' => $_POST,
                    'method' => $_SERVER['REQUEST_METHOD']
                ]
            ]);
            break;
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?> 