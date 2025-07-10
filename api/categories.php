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

// 启用调试
error_reporting(E_ALL);
ini_set('display_errors', 1);

session_start();

error_log('Categories API called');
error_log('Request method: ' . $_SERVER['REQUEST_METHOD']);
error_log('GET params: ' . print_r($_GET, true));
error_log('POST params: ' . print_r($_POST, true));

require_once '../config.php';
require_once 'auth-functions.php';

// 获取类目列表
function getCategories() {
    $pdo = getConnection();
    
    $stmt = $pdo->prepare("SELECT * FROM categories ORDER BY id");
    $stmt->execute();
    $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    return ['success' => true, 'data' => $categories];
}

// 获取类目及其奖项
function getCategoriesWithItems() {
    $pdo = getConnection();
    
    // 获取所有类目
    $stmt = $pdo->prepare("SELECT * FROM categories ORDER BY id");
    $stmt->execute();
    $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 获取每个类目的奖项和分数配置
    foreach ($categories as &$category) {
        // 确保category有id
        if (!isset($category['id'])) {
            error_log('Warning: Category without ID found: ' . print_r($category, true));
            continue;
        }
        
        $stmt = $pdo->prepare("SELECT * FROM items WHERE category_id = ? ORDER BY id");
        $stmt->execute([$category['id']]);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // 获取每个奖项的分数配置
        foreach ($items as &$item) {
            if (!isset($item['id'])) {
                error_log('Warning: Item without ID found: ' . print_r($item, true));
                continue;
            }
            
            // 获取分数配置（包含自定义等级名称和团体/个人类型）
            $stmt = $pdo->prepare("SELECT level, grade, score, custom_grade_name, award_type FROM item_scores WHERE item_id = ?");
            $stmt->execute([$item['id']]);
            $scores = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $item['scores'] = [];
            $item['score_details'] = []; // 详细分数信息，包含自定义名称和类型
            foreach ($scores as $score) {
                $item['scores'][$score['level'] . '_' . $score['grade']] = $score['score'];
                $item['score_details'][$score['level'] . '_' . $score['grade']] = [
                    'score' => $score['score'],
                    'custom_grade_name' => $score['custom_grade_name'],
                    'award_type' => $score['award_type']
                ];
            }
            
            // 获取自定义等级配置
            $stmt = $pdo->prepare("SELECT grade_key, grade_name, sort_order FROM custom_grades WHERE item_id = ? ORDER BY sort_order");
            $stmt->execute([$item['id']]);
            $customGrades = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $item['custom_grades'] = $customGrades;
        }
        
        // 确保items是一个数组，即使是空的
        $category['items'] = $items ?: [];
    }
    
    error_log('Categories with items: ' . print_r($categories, true));
    return ['success' => true, 'data' => $categories];
}

// 创建类目
function createCategory($name, $score, $description = '', $maxScoreLimit = 0) {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    $stmt = $pdo->prepare("INSERT INTO categories (name, score, max_score_limit, description) VALUES (?, ?, ?, ?)");
    $stmt->execute([$name, $score, $maxScoreLimit, $description]);
    
    return ['success' => true, 'message' => '类目创建成功', 'id' => $pdo->lastInsertId()];
}

// 更新类目
function updateCategory($id, $name, $score, $description = '', $maxScoreLimit = 0) {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    $stmt = $pdo->prepare("UPDATE categories SET name = ?, score = ?, max_score_limit = ?, description = ? WHERE id = ?");
    $stmt->execute([$name, $score, $maxScoreLimit, $description, $id]);
    
    return ['success' => true, 'message' => '类目更新成功'];
}

// 删除类目
function deleteCategory($id) {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    // 检查是否有相关的申请材料
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM application_materials WHERE category_id = ?");
    $stmt->execute([$id]);
    $count = $stmt->fetchColumn();
    
    if ($count > 0) {
        return ['success' => false, 'message' => '该类目下有申请材料，不能删除'];
    }
    
    $stmt = $pdo->prepare("DELETE FROM categories WHERE id = ?");
    $stmt->execute([$id]);
    
    return ['success' => true, 'message' => '类目删除成功'];
}

// 创建奖项
function createItem($categoryId, $name, $description = '', $copyTemplate = false, $templateItemId = null) {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    $stmt = $pdo->prepare("INSERT INTO items (category_id, name, description) VALUES (?, ?, ?)");
    $stmt->execute([$categoryId, $name, $description]);
    $itemId = $pdo->lastInsertId();
    
    if ($copyTemplate && $templateItemId) {
        // 复制模板奖项的分数配置
        $stmt = $pdo->prepare("SELECT level, grade, score, custom_grade_name, award_type FROM item_scores WHERE item_id = ?");
        $stmt->execute([$templateItemId]);
        $templateScores = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // 复制自定义等级配置
        $stmt = $pdo->prepare("SELECT grade_key, grade_name, sort_order FROM custom_grades WHERE item_id = ?");
        $stmt->execute([$templateItemId]);
        $templateGrades = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (!empty($templateScores)) {
            foreach ($templateScores as $scoreConfig) {
                $stmt = $pdo->prepare("INSERT INTO item_scores (item_id, level, grade, score, custom_grade_name, award_type) VALUES (?, ?, ?, ?, ?, ?)");
                $stmt->execute([$itemId, $scoreConfig['level'], $scoreConfig['grade'], $scoreConfig['score'], $scoreConfig['custom_grade_name'], $scoreConfig['award_type']]);
            }
        } else {
            // 如果模板没有分数配置，则创建默认配置
            createDefaultScoresAndGrades($pdo, $itemId, 'individual');
        }
        
        if (!empty($templateGrades)) {
            foreach ($templateGrades as $gradeConfig) {
                $stmt = $pdo->prepare("INSERT INTO custom_grades (item_id, grade_key, grade_name, sort_order) VALUES (?, ?, ?, ?)");
                $stmt->execute([$itemId, $gradeConfig['grade_key'], $gradeConfig['grade_name'], $gradeConfig['sort_order']]);
            }
        } else {
            // 如果模板没有自定义等级，则创建默认等级
            createDefaultCustomGrades($pdo, $itemId);
        }
    } else {
        // 创建默认分数配置和自定义等级
        createDefaultScoresAndGrades($pdo, $itemId, 'individual');
        createDefaultCustomGrades($pdo, $itemId);
    }
    
    return ['success' => true, 'message' => '奖项创建成功', 'id' => $itemId];
}
    
    // 创建默认分数配置
function createDefaultScoresAndGrades($pdo, $itemId, $defaultAwardType = 'individual') {
    $levels = ['national', 'provincial', 'municipal', 'university', 'college', 'ungraded'];
    $grades = ['first', 'second', 'third', 'encouragement', 'participation', 'none'];
    
    $gradeNames = [
        'first' => '一等奖',
        'second' => '二等奖', 
        'third' => '三等奖',
        'encouragement' => '鼓励奖',
        'participation' => '参与奖',
        'none' => '无等级'
    ];
    
    foreach ($levels as $level) {
        foreach ($grades as $grade) {
            $customGradeName = $gradeNames[$grade] ?? '未知等级';
            $stmt = $pdo->prepare("INSERT INTO item_scores (item_id, level, grade, score, custom_grade_name, award_type) VALUES (?, ?, ?, 0, ?, ?)");
            $stmt->execute([$itemId, $level, $grade, $customGradeName, $defaultAwardType]);
        }
    }
}

// 创建默认自定义等级
function createDefaultCustomGrades($pdo, $itemId) {
    $gradeConfigs = [
        ['grade_key' => 'first', 'grade_name' => '一等奖', 'sort_order' => 1],
        ['grade_key' => 'second', 'grade_name' => '二等奖', 'sort_order' => 2],
        ['grade_key' => 'third', 'grade_name' => '三等奖', 'sort_order' => 3],
        ['grade_key' => 'encouragement', 'grade_name' => '鼓励奖', 'sort_order' => 4],
        ['grade_key' => 'participation', 'grade_name' => '参与奖', 'sort_order' => 5],
        ['grade_key' => 'none', 'grade_name' => '无等级', 'sort_order' => 6]
    ];
    
    foreach ($gradeConfigs as $config) {
        $stmt = $pdo->prepare("INSERT INTO custom_grades (item_id, grade_key, grade_name, sort_order) VALUES (?, ?, ?, ?)");
        $stmt->execute([$itemId, $config['grade_key'], $config['grade_name'], $config['sort_order']]);
    }
}

// 更新奖项分数
function updateItemScore($itemId, $level, $grade, $score, $customGradeName = null, $awardType = null) {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    // 构建更新SQL
    $updateFields = ['score = ?'];
    $params = [$score];
    
    if ($customGradeName !== null) {
        $updateFields[] = 'custom_grade_name = ?';
        $params[] = $customGradeName;
    }
    
    if ($awardType !== null) {
        $updateFields[] = 'award_type = ?';
        $params[] = $awardType;
    }
    
    $params[] = $itemId;
    $params[] = $level;
    $params[] = $grade;
    
    $sql = "UPDATE item_scores SET " . implode(', ', $updateFields) . " WHERE item_id = ? AND level = ? AND grade = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    
    return ['success' => true, 'message' => '分数更新成功'];
}

// 删除奖项
function deleteItem($id) {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    // 检查是否有相关的申请材料
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM application_materials WHERE item_id = ?");
    $stmt->execute([$id]);
    $count = $stmt->fetchColumn();
    
    if ($count > 0) {
        return ['success' => false, 'message' => '该奖项下有申请材料，不能删除'];
    }
    
    $stmt = $pdo->prepare("DELETE FROM items WHERE id = ?");
    $stmt->execute([$id]);
    
    return ['success' => true, 'message' => '奖项删除成功'];
}

// 更新自定义等级名称
function updateCustomGrade($itemId, $gradeKey, $gradeName) {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    // 更新custom_grades表
    $stmt = $pdo->prepare("UPDATE custom_grades SET grade_name = ? WHERE item_id = ? AND grade_key = ?");
    $stmt->execute([$gradeName, $itemId, $gradeKey]);
    
    // 同时更新item_scores表中对应的custom_grade_name
    $stmt = $pdo->prepare("UPDATE item_scores SET custom_grade_name = ? WHERE item_id = ? AND grade = ?");
    $stmt->execute([$gradeName, $itemId, $gradeKey]);
    
    return ['success' => true, 'message' => '等级名称更新成功'];
}

// 处理请求
try {
    $action = $_GET['action'] ?? $_POST['action'] ?? '';
    
    // 处理JSON请求体
    $requestData = [];
    if (empty($action) || $_SERVER['REQUEST_METHOD'] === 'POST') {
        $inputData = file_get_contents('php://input');
        if (!empty($inputData)) {
            $jsonData = json_decode($inputData, true);
            if ($jsonData && isset($jsonData['action'])) {
                $action = $jsonData['action'];
                $requestData = $jsonData;
                error_log('JSON request data: ' . print_r($requestData, true));
            }
        }
    }
    
    error_log('Processing action: ' . $action);
    
    switch ($action) {
        case 'list':
            $result = getCategories();
            echo json_encode($result);
            break;
            
        case 'list_with_items':
            $result = getCategoriesWithItems();
            echo json_encode(['success' => true, 'categories' => $result['data']]);
            break;
            
        case 'create':
            $name = $requestData['name'] ?? $_POST['name'] ?? '';
            $score = $requestData['score'] ?? $_POST['score'] ?? 0;
            $description = $requestData['description'] ?? $_POST['description'] ?? '';
            $maxScoreLimit = $requestData['max_score_limit'] ?? $_POST['max_score_limit'] ?? 0;
            
            if (empty($name)) {
                echo json_encode(['success' => false, 'message' => '类目名称不能为空']);
                break;
            }
            
            $result = createCategory($name, $score, $description, $maxScoreLimit);
            echo json_encode($result);
            break;
            
        case 'update':
            $id = $requestData['id'] ?? $_POST['id'] ?? 0;
            $name = $requestData['name'] ?? $_POST['name'] ?? '';
            $score = $requestData['score'] ?? $_POST['score'] ?? 0;
            $description = $requestData['description'] ?? $_POST['description'] ?? '';
            $maxScoreLimit = $requestData['max_score_limit'] ?? $_POST['max_score_limit'] ?? 0;
            
            if (!$id || empty($name)) {
                echo json_encode(['success' => false, 'message' => '参数不完整']);
                break;
            }
            
            $result = updateCategory($id, $name, $score, $description, $maxScoreLimit);
            echo json_encode($result);
            break;
            
        case 'delete':
            $id = $requestData['id'] ?? $_POST['id'] ?? 0;
            if (!$id) {
                echo json_encode(['success' => false, 'message' => '类目ID不能为空']);
                break;
            }
            
            $result = deleteCategory($id);
            echo json_encode($result);
            break;
            
        case 'create_item':
            $categoryId = $requestData['category_id'] ?? $_POST['category_id'] ?? 0;
            $name = $requestData['name'] ?? $_POST['name'] ?? '';
            $description = $requestData['description'] ?? $_POST['description'] ?? '';
            $copyTemplate = $requestData['copy_template'] ?? $_POST['copy_template'] ?? false;
            $templateItemId = $requestData['template_item_id'] ?? $_POST['template_item_id'] ?? null;
            
            if (!$categoryId || empty($name)) {
                echo json_encode(['success' => false, 'message' => '参数不完整']);
                break;
            }
            
            if ($copyTemplate && !$templateItemId) {
                echo json_encode(['success' => false, 'message' => '选择复制模板时必须指定模板奖项ID']);
                break;
            }
            
            $result = createItem($categoryId, $name, $description, $copyTemplate, $templateItemId);
            echo json_encode($result);
            break;
            
        case 'update_item_score':
            $itemId = $requestData['item_id'] ?? $_POST['item_id'] ?? 0;
            $level = $requestData['level'] ?? $_POST['level'] ?? '';
            $grade = $requestData['grade'] ?? $_POST['grade'] ?? '';
            $score = $requestData['score'] ?? $_POST['score'] ?? 0;
            $customGradeName = $requestData['custom_grade_name'] ?? $_POST['custom_grade_name'] ?? null;
            $awardType = $requestData['award_type'] ?? $_POST['award_type'] ?? null;
            
            if (!$itemId || empty($level) || empty($grade)) {
                echo json_encode(['success' => false, 'message' => '参数不完整']);
                break;
            }
            
            $result = updateItemScore($itemId, $level, $grade, $score, $customGradeName, $awardType);
            echo json_encode($result);
            break;
            
        case 'update_custom_grade':
            $itemId = $requestData['item_id'] ?? $_POST['item_id'] ?? 0;
            $gradeKey = $requestData['grade_key'] ?? $_POST['grade_key'] ?? '';
            $gradeName = $requestData['grade_name'] ?? $_POST['grade_name'] ?? '';
            
            if (!$itemId || empty($gradeKey) || empty($gradeName)) {
                echo json_encode(['success' => false, 'message' => '参数不完整']);
                break;
            }
            
            $result = updateCustomGrade($itemId, $gradeKey, $gradeName);
            echo json_encode($result);
            break;
            

            
        case 'delete_item':
            $id = $requestData['id'] ?? $_POST['id'] ?? 0;
            if (!$id) {
                echo json_encode(['success' => false, 'message' => '奖项ID不能为空']);
                break;
            }
            
            $result = deleteItem($id);
            echo json_encode($result);
            break;
            
        default:
            error_log('Unknown action: ' . $action);
            echo json_encode(['success' => false, 'message' => '未知操作: ' . $action]);
            break;
    }
} catch (Exception $e) {
    error_log('Categories API Exception: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?> 