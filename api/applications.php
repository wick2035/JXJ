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

// 检查用户是否已在某批次中提交申请
function checkUserApplicationInBatch($userId, $batchId) {
    $pdo = getConnection();
    
    $stmt = $pdo->prepare("SELECT id FROM applications WHERE user_id = ? AND batch_id = ?");
    $stmt->execute([$userId, $batchId]);
    $application = $stmt->fetch(PDO::FETCH_ASSOC);
    
    return ['success' => true, 'has_applied' => !empty($application), 'application_id' => $application['id'] ?? null];
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
function getAllApplications($status = null) {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    // 构建基础SQL查询
    $sql = "
        SELECT a.*, b.name as batch_name, u.real_name as user_name, u.class, u.student_id
        FROM applications a 
        LEFT JOIN batches b ON a.batch_id = b.id 
        LEFT JOIN users u ON a.user_id = u.id
    ";
    
    $params = [];
    
    // 如果有状态筛选条件
    if ($status && in_array($status, ['pending', 'approved', 'rejected'])) {
        $sql .= " WHERE a.status = ?";
        $params[] = $status;
    }
    
    $sql .= " ORDER BY a.submitted_at DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
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
            
            error_log("Updating existing application ID: $applicationId");
            
            // 🔥 重大修复：完全重新设计更新逻辑
            // 不再删除旧材料，而是智能更新现有材料和文件
            
            // 1. 获取现有材料和文件的映射关系
            $stmt = $pdo->prepare("
                SELECT am.id as material_id, am.category_id, am.item_id, 
                       uf.id as file_id, uf.original_name, uf.file_path
                FROM application_materials am
                LEFT JOIN uploaded_files uf ON am.id = uf.material_id
                WHERE am.application_id = ?
            ");
            $stmt->execute([$applicationId]);
            $existingData = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            error_log("Existing materials and files: " . print_r($existingData, true));
            
            // 2. 构建现有材料的索引（按 category_id + item_id）
            $existingMaterialsMap = [];
            $existingFilesMap = [];
            foreach ($existingData as $row) {
                $key = $row['category_id'] . '_' . $row['item_id'];
                if (!isset($existingMaterialsMap[$key])) {
                    $existingMaterialsMap[$key] = $row['material_id'];
                    $existingFilesMap[$key] = [];
                }
                if ($row['file_id']) {
                    $existingFilesMap[$key][] = $row['file_id'];
                }
            }
            
            error_log("Existing materials map: " . print_r($existingMaterialsMap, true));
            error_log("Existing files map: " . print_r($existingFilesMap, true));
            
            // 重新设置申请状态为待审核，清除审核相关字段
            $stmt = $pdo->prepare("UPDATE applications SET status = 'pending', review_comment = NULL, reviewed_by = NULL, reviewed_at = NULL WHERE id = ?");
            $stmt->execute([$applicationId]);
        } else {
            // 创建新申请
            $stmt = $pdo->prepare("INSERT INTO applications (user_id, batch_id, status) VALUES (?, ?, 'pending')");
            $stmt->execute([$userId, $batchId]);
            $applicationId = $pdo->lastInsertId();
        }
        
        $totalScore = 0;
        $processedMaterials = []; // 跟踪处理过的材料
        
        // 保存/更新材料数据
        foreach ($materials as $material) {
            // 确保score不为null
            $score = isset($material['score']) ? (int)$material['score'] : 0;
            
            error_log("Processing material: " . print_r($material, true));
            
            $materialKey = $material['category_id'] . '_' . $material['item_id'];
            $processedMaterials[] = $materialKey;
            
            // 🔥 关键修复：检查是否存在相同的材料
            if ($existingApp && isset($existingMaterialsMap[$materialKey])) {
                // 更新现有材料
                $materialId = $existingMaterialsMap[$materialKey];
                error_log("Updating existing material ID: $materialId for key: $materialKey");
                
                $stmt = $pdo->prepare("
                    UPDATE application_materials 
                    SET award_level = ?, award_grade = ?, score = ?
                    WHERE id = ?
                ");
                $stmt->execute([
                    $material['award_level'],
                    $material['award_grade'],
                    $score,
                    $materialId
                ]);
            } else {
                // 插入新材料
                error_log("Inserting new material for key: $materialKey");
                
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
            }
            
            $totalScore += $score;
            
            // 🔥 关键修复：智能处理文件数据
            if (isset($material['files']) && is_array($material['files']) && count($material['files']) > 0) {
                error_log("Material has " . count($material['files']) . " files to process");
                
                // 收集要保留的文件ID
                $keepFileIds = [];
                
                foreach ($material['files'] as $fileIndex => $file) {
                    error_log("Processing file $fileIndex: " . print_r($file, true));
                    
                    if ((isset($file['is_existing']) && $file['is_existing']) || (isset($file['id']) && $file['id'])) {
                        // 已存在的文件，只需要保留，不需要移动
                        $fileId = $file['id'];
                        if ($fileId && is_numeric($fileId)) {
                            $keepFileIds[] = $fileId;
                            error_log("Keeping existing file ID: $fileId");
                        }
                    } else {
                        // 新上传的文件，插入新记录
                        $originalName = $file['original_name'] ?? $file['name'] ?? '未知文件';
                        $fileName = $file['file_name'] ?? $file['path'] ?? '';
                        $filePath = $file['file_path'] ?? $file['path'] ?? '';
                        $fileSize = $file['file_size'] ?? $file['size'] ?? 0;
                        $fileType = $file['file_type'] ?? $file['type'] ?? '';
                        
                        error_log("Saving new file: originalName=$originalName, fileName=$fileName, filePath=$filePath");
                        
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
                        $newFileId = $pdo->lastInsertId();
                        $keepFileIds[] = $newFileId;
                        error_log("Saved new file with ID: $newFileId");
                    }
                }
                
                // 删除该材料下不再需要的文件
                if (!empty($keepFileIds)) {
                    $placeholders = str_repeat('?,', count($keepFileIds) - 1) . '?';
                    $stmt = $pdo->prepare("
                        DELETE FROM uploaded_files 
                        WHERE material_id = ? AND id NOT IN ($placeholders)
                    ");
                    $params = array_merge([$materialId], $keepFileIds);
                    $stmt->execute($params);
                    error_log("For material $materialId, kept files: " . implode(', ', $keepFileIds));
                }
                
            } else if ($existingApp && isset($existingFilesMap[$materialKey])) {
                // 如果前端没有传文件数据，但数据库中有文件，保留原有文件
                error_log("No files from frontend, but existing files found for material $materialId - keeping existing files");
            } else {
                error_log("No files data for material ID: $materialId");
            }
        }
        
        // 🔥 删除不再需要的材料（用户删除的材料）
        if ($existingApp && !empty($existingMaterialsMap)) {
            foreach ($existingMaterialsMap as $key => $materialId) {
                if (!in_array($key, $processedMaterials)) {
                    error_log("Deleting unused material ID: $materialId for key: $key");
                    $stmt = $pdo->prepare("DELETE FROM application_materials WHERE id = ?");
                    $stmt->execute([$materialId]);
                    // 文件会因为外键约束自动删除
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

// 获取学生申请统计数据
function getStudentApplicationStats($batchId = null, $class = null) {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    try {
        // 构建基础查询 - 获取所有学生用户
        $sql = "
            SELECT 
                u.id,
                u.username,
                u.real_name,
                u.student_id,
                u.class,
                u.major,
                CASE WHEN a.id IS NOT NULL THEN 'submitted' ELSE 'not_submitted' END as submission_status,
                a.status as application_status,
                a.total_score,
                a.submitted_at,
                b.name as batch_name
            FROM users u
            LEFT JOIN applications a ON u.id = a.user_id" . ($batchId ? " AND a.batch_id = ?" : "") . "
            LEFT JOIN batches b ON a.batch_id = b.id
            WHERE u.type = 'student'
        ";
        
        $params = [];
        
        // 添加批次筛选
        if ($batchId) {
            $params[] = $batchId;
        }
        
        // 添加班级筛选
        if ($class) {
            $sql .= " AND u.class = ?";
            $params[] = $class;
        }
        
        $sql .= " ORDER BY u.class, u.student_id, u.real_name";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // 获取所有班级列表（用于筛选）
        $stmt = $pdo->prepare("SELECT DISTINCT class FROM users WHERE type = 'student' AND class IS NOT NULL ORDER BY class");
        $stmt->execute();
        $classes = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        // 获取所有批次列表（用于筛选）
        $stmt = $pdo->prepare("SELECT id, name FROM batches ORDER BY created_at DESC");
        $stmt->execute();
        $batches = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // 计算统计数据
        $stats = [
            'total_students' => 0,
            'submitted_students' => 0,
            'not_submitted_students' => 0,
            'by_class' => []
        ];
        
        $classCounts = [];
        
        foreach ($students as $student) {
            $stats['total_students']++;
            
            $class = $student['class'] ?: '未分班';
            if (!isset($classCounts[$class])) {
                $classCounts[$class] = [
                    'total' => 0,
                    'submitted' => 0,
                    'not_submitted' => 0
                ];
            }
            $classCounts[$class]['total']++;
            
            if ($student['submission_status'] === 'submitted') {
                $stats['submitted_students']++;
                $classCounts[$class]['submitted']++;
            } else {
                $stats['not_submitted_students']++;
                $classCounts[$class]['not_submitted']++;
            }
        }
        
        $stats['by_class'] = $classCounts;
        
        return [
            'success' => true, 
            'data' => [
                'students' => $students,
                'stats' => $stats,
                'classes' => $classes,
                'batches' => $batches
            ]
        ];
        
    } catch (Exception $e) {
        return ['success' => false, 'message' => '获取统计数据失败: ' . $e->getMessage()];
    }
}

// 添加批次
function addBatch($name, $description, $startDate, $endDate, $status) {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    try {
        $stmt = $pdo->prepare("INSERT INTO batches (name, description, start_date, end_date, status) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$name, $description, $startDate, $endDate, $status]);
        
        return ['success' => true, 'message' => '批次添加成功', 'id' => $pdo->lastInsertId()];
    } catch (Exception $e) {
        return ['success' => false, 'message' => '添加失败: ' . $e->getMessage()];
    }
}

// 更新批次
function updateBatch($id, $name, $description, $startDate, $endDate, $status) {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    try {
        $stmt = $pdo->prepare("UPDATE batches SET name = ?, description = ?, start_date = ?, end_date = ?, status = ? WHERE id = ?");
        $stmt->execute([$name, $description, $startDate, $endDate, $status, $id]);
        
        return ['success' => true, 'message' => '批次更新成功'];
    } catch (Exception $e) {
        return ['success' => false, 'message' => '更新失败: ' . $e->getMessage()];
    }
}

// 删除批次
function deleteBatch($id) {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    try {
        // 检查是否有申请使用此批次
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM applications WHERE batch_id = ?");
        $stmt->execute([$id]);
        $count = $stmt->fetchColumn();
        
        if ($count > 0) {
            return ['success' => false, 'message' => '该批次已有申请，无法删除'];
        }
        
        $stmt = $pdo->prepare("DELETE FROM batches WHERE id = ?");
        $stmt->execute([$id]);
        
        return ['success' => true, 'message' => '批次删除成功'];
    } catch (Exception $e) {
        return ['success' => false, 'message' => '删除失败: ' . $e->getMessage()];
    }
}

// 删除申请（管理员）
function deleteApplication($id) {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    try {
        $pdo->beginTransaction();
        
        // 获取申请详情，包括文件信息
        $stmt = $pdo->prepare("
            SELECT uf.file_path 
            FROM uploaded_files uf
            JOIN application_materials am ON uf.material_id = am.id
            WHERE am.application_id = ?
        ");
        $stmt->execute([$id]);
        $files = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // 删除物理文件
        foreach ($files as $file) {
            $filePath = '../' . $file['file_path'];
            if (file_exists($filePath)) {
                unlink($filePath);
            }
        }
        
        // 删除数据库记录（由于外键约束，会自动级联删除相关记录）
        $stmt = $pdo->prepare("DELETE FROM applications WHERE id = ?");
        $stmt->execute([$id]);
        
        $pdo->commit();
        return ['success' => true, 'message' => '申请删除成功'];
        
    } catch (Exception $e) {
        $pdo->rollBack();
        return ['success' => false, 'message' => '删除失败: ' . $e->getMessage()];
    }
}

// 处理请求
try {
    $action = $_GET['action'] ?? $_POST['action'] ?? '';
    
    // 获取JSON数据（如果有的话）
    $inputData = file_get_contents('php://input');
    $json_data = [];
    if ($inputData) {
        $requestData = json_decode($inputData, true);
        if ($requestData && is_array($requestData)) {
            $json_data = $requestData;
            if (isset($requestData['action']) && empty($action)) {
                $action = $requestData['action'];
            }
        }
    }
    
    error_log("Applications API called with action: $action");
    error_log("Request method: " . $_SERVER['REQUEST_METHOD']);
    error_log("Content type: " . ($_SERVER['CONTENT_TYPE'] ?? 'not set'));
    error_log("POST data: " . print_r($_POST, true));
    error_log("JSON data: " . print_r($json_data, true));
    
    switch ($action) {
        case 'getBatches':
        case 'get_batches':
            $result = getBatches();
            echo json_encode(['success' => true, 'batches' => $result['data']]);
            break;
            
        case 'check_application_status':
            $loginResult = checkLogin();
            if (!$loginResult['success']) {
                echo json_encode($loginResult);
                break;
            }
            
            $batchId = $_GET['batch_id'] ?? 0;
            if (!$batchId) {
                echo json_encode(['success' => false, 'message' => '批次ID不能为空']);
                break;
            }
            
            $result = checkUserApplicationInBatch($_SESSION['user_id'], $batchId);
            echo json_encode($result);
            break;
            
        case 'get_user_applications':
        case 'getMyApplications':
            $loginResult = checkLogin();
            if (!$loginResult['success']) {
                echo json_encode($loginResult);
                break;
            }
            
            $result = getUserApplications($_SESSION['user_id']);
            echo json_encode(['success' => true, 'applications' => $result['data']]);
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
        case 'getAllApplications':
            $status = $_GET['status'] ?? $_POST['status'] ?? null;
            $result = getAllApplications($status);
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
            
        case 'student_stats':
        case 'getStudentStats':
            $batchId = $_GET['batch_id'] ?? $_POST['batch_id'] ?? null;
            $class = $_GET['class'] ?? $_POST['class'] ?? null;
            $result = getStudentApplicationStats($batchId, $class);
            echo json_encode($result);
            break;
            
        case 'addBatch':
        case 'add_batch':
            error_log("Processing addBatch request");
            error_log("POST data: " . print_r($_POST, true));
            error_log("JSON data: " . print_r($json_data, true));
            
            // 合并所有数据源
            $all_data = array_merge($_POST, $json_data);
            $name = trim($all_data['name'] ?? '');
            $description = trim($all_data['description'] ?? '');
            $startDate = trim($all_data['start_date'] ?? '');
            $endDate = trim($all_data['end_date'] ?? '');
            $status = trim($all_data['status'] ?? 'open');
            
            error_log("Extracted data: name='$name', description='$description', startDate='$startDate', endDate='$endDate', status='$status'");
            
            if (empty($name)) {
                error_log("Validation failed: name is empty");
                echo json_encode(['success' => false, 'message' => '批次名称不能为空']);
                break;
            }
            
            if (empty($startDate)) {
                error_log("Validation failed: startDate is empty");
                echo json_encode(['success' => false, 'message' => '开始日期不能为空']);
                break;
            }
            
            if (empty($endDate)) {
                error_log("Validation failed: endDate is empty");
                echo json_encode(['success' => false, 'message' => '结束日期不能为空']);
                break;
            }
            
            $result = addBatch($name, $description, $startDate, $endDate, $status);
            error_log("addBatch result: " . print_r($result, true));
            echo json_encode($result);
            break;
            
        case 'updateBatch':
        case 'update_batch':
            // 合并所有数据源
            $all_data = array_merge($_POST, $json_data);
            $id = $all_data['id'] ?? 0;
            $name = $all_data['name'] ?? '';
            $description = $all_data['description'] ?? '';
            $startDate = $all_data['start_date'] ?? '';
            $endDate = $all_data['end_date'] ?? '';
            $status = $all_data['status'] ?? 'open';
            
            if (!$id || empty($name) || empty($startDate) || empty($endDate)) {
                echo json_encode(['success' => false, 'message' => '参数不完整']);
                break;
            }
            
            $result = updateBatch($id, $name, $description, $startDate, $endDate, $status);
            echo json_encode($result);
            break;
            
        case 'deleteBatch':
        case 'delete_batch':
            // 合并所有数据源
            $all_data = array_merge($_POST, $json_data);
            $id = $all_data['id'] ?? 0;
            
            if (!$id) {
                echo json_encode(['success' => false, 'message' => '批次ID不能为空']);
                break;
            }
            
            $result = deleteBatch($id);
            echo json_encode($result);
            break;
            
        case 'deleteApplication':
            // 处理JSON请求体中的id参数
            $inputData = file_get_contents('php://input');
            $requestData = json_decode($inputData, true);
            
            $id = 0;
            if ($requestData && isset($requestData['id'])) {
                $id = (int)$requestData['id'];
            } else {
                $id = (int)($_POST['id'] ?? 0);
            }
            
            error_log("Delete application request - ID: $id, POST: " . print_r($_POST, true) . ", JSON: " . print_r($requestData, true));
            
            if (!$id) {
                echo json_encode(['success' => false, 'message' => '申请ID不能为空']);
                break;
            }
            
            $result = deleteApplication($id);
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