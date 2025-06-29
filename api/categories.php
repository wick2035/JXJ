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
            
            $stmt = $pdo->prepare("SELECT level, grade, score FROM item_scores WHERE item_id = ?");
            $stmt->execute([$item['id']]);
            $scores = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $item['scores'] = [];
            foreach ($scores as $score) {
                $item['scores'][$score['level'] . '_' . $score['grade']] = $score['score'];
            }
        }
        
        // 确保items是一个数组，即使是空的
        $category['items'] = $items ?: [];
    }
    
    error_log('Categories with items: ' . print_r($categories, true));
    return ['success' => true, 'data' => $categories];
}

// 创建类目
function createCategory($name, $score, $description = '') {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    $stmt = $pdo->prepare("INSERT INTO categories (name, score, description) VALUES (?, ?, ?)");
    $stmt->execute([$name, $score, $description]);
    
    return ['success' => true, 'message' => '类目创建成功', 'id' => $pdo->lastInsertId()];
}

// 更新类目
function updateCategory($id, $name, $score, $description = '') {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    $stmt = $pdo->prepare("UPDATE categories SET name = ?, score = ?, description = ? WHERE id = ?");
    $stmt->execute([$name, $score, $description, $id]);
    
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
function createItem($categoryId, $name, $description = '') {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    $stmt = $pdo->prepare("INSERT INTO items (category_id, name, description) VALUES (?, ?, ?)");
    $stmt->execute([$categoryId, $name, $description]);
    $itemId = $pdo->lastInsertId();
    
    // 创建默认分数配置
    $levels = ['national', 'provincial', 'municipal', 'university', 'college', 'ungraded'];
    $grades = ['first', 'second', 'third', 'none'];
    
    foreach ($levels as $level) {
        foreach ($grades as $grade) {
            $stmt = $pdo->prepare("INSERT INTO item_scores (item_id, level, grade, score) VALUES (?, ?, ?, 0)");
            $stmt->execute([$itemId, $level, $grade]);
        }
    }
    
    return ['success' => true, 'message' => '奖项创建成功', 'id' => $itemId];
}

// 更新奖项分数
function updateItemScore($itemId, $level, $grade, $score) {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    $stmt = $pdo->prepare("UPDATE item_scores SET score = ? WHERE item_id = ? AND level = ? AND grade = ?");
    $stmt->execute([$score, $itemId, $level, $grade]);
    
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
            
            if (empty($name)) {
                echo json_encode(['success' => false, 'message' => '类目名称不能为空']);
                break;
            }
            
            $result = createCategory($name, $score, $description);
            echo json_encode($result);
            break;
            
        case 'update':
            $id = $requestData['id'] ?? $_POST['id'] ?? 0;
            $name = $requestData['name'] ?? $_POST['name'] ?? '';
            $score = $requestData['score'] ?? $_POST['score'] ?? 0;
            $description = $requestData['description'] ?? $_POST['description'] ?? '';
            
            if (!$id || empty($name)) {
                echo json_encode(['success' => false, 'message' => '参数不完整']);
                break;
            }
            
            $result = updateCategory($id, $name, $score, $description);
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
            
            if (!$categoryId || empty($name)) {
                echo json_encode(['success' => false, 'message' => '参数不完整']);
                break;
            }
            
            $result = createItem($categoryId, $name, $description);
            echo json_encode($result);
            break;
            
        case 'update_item_score':
            $itemId = $requestData['item_id'] ?? $_POST['item_id'] ?? 0;
            $level = $requestData['level'] ?? $_POST['level'] ?? '';
            $grade = $requestData['grade'] ?? $_POST['grade'] ?? '';
            $score = $requestData['score'] ?? $_POST['score'] ?? 0;
            
            if (!$itemId || empty($level) || empty($grade)) {
                echo json_encode(['success' => false, 'message' => '参数不完整']);
                break;
            }
            
            $result = updateItemScore($itemId, $level, $grade, $score);
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