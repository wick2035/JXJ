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

// 获取批次排名数据
function getBatchRanking($batchId) {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    try {
        // 获取批次信息
        $stmt = $pdo->prepare("SELECT * FROM batches WHERE id = ?");
        $stmt->execute([$batchId]);
        $batch = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$batch) {
            return ['success' => false, 'message' => '批次不存在'];
        }
        
        // 获取该批次下所有已审核通过的申请，按总分数排序
        $stmt = $pdo->prepare("
            SELECT 
                a.id,
                a.total_score,
                a.reviewed_at,
                u.real_name,
                u.student_id,
                u.class,
                u.major,
                u.username
            FROM applications a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.batch_id = ? AND a.status = 'approved'
            ORDER BY a.total_score DESC, a.reviewed_at ASC
        ");
        $stmt->execute([$batchId]);
        $rankings = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // 添加排名号
        foreach ($rankings as $index => &$ranking) {
            $ranking['rank'] = $index + 1;
            
            // 获取该申请的详细材料信息
            $stmt = $pdo->prepare("
                SELECT 
                    am.*,
                    c.name as category_name,
                    i.name as item_name
                FROM application_materials am
                LEFT JOIN categories c ON am.category_id = c.id
                LEFT JOIN items i ON am.item_id = i.id
                WHERE am.application_id = ?
                ORDER BY c.id, i.id
            ");
            $stmt->execute([$ranking['id']]);
            $materials = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // 按类目分组材料
            $categorizedMaterials = [];
            $categoryScores = []; // 原始分数
            foreach ($materials as $material) {
                $categoryName = $material['category_name'];
                $categoryId = $material['category_id'];
                
                if (!isset($categorizedMaterials[$categoryName])) {
                    $categorizedMaterials[$categoryName] = [];
                    $categoryScores[$categoryId] = 0;
                }
                $categorizedMaterials[$categoryName][] = $material;
                $categoryScores[$categoryId] += $material['score'];
            }
            
            // 获取类目配置信息并计算有效分数
            $effectiveCategoryScores = [];
            if (!empty($categoryScores)) {
                $categoryIds = array_keys($categoryScores);
                $placeholders = str_repeat('?,', count($categoryIds) - 1) . '?';
                $stmt = $pdo->prepare("SELECT id, name, score, max_score_limit FROM categories WHERE id IN ($placeholders)");
                $stmt->execute($categoryIds);
                $categoryConfigs = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                foreach ($categoryConfigs as $config) {
                    $categoryId = $config['id'];
                    $categoryName = $config['name'];
                    $rawScore = $categoryScores[$categoryId] ?? 0;
                    $hasLimit = $config['max_score_limit'] == 1;
                    
                    // 如果设置了100分上限，则限制最高为100
                    $effectiveScore = $hasLimit ? min($rawScore, 100) : $rawScore;
                    
                    $effectiveCategoryScores[$categoryName] = [
                        'raw_score' => $rawScore,
                        'effective_score' => $effectiveScore,
                        'score_ratio' => $config['score'],
                        'has_limit' => $hasLimit,
                        'contribution' => ($effectiveScore * $config['score']) / 100
                    ];
                }
            }
            
            $ranking['materials'] = $categorizedMaterials;
            $ranking['category_scores'] = $effectiveCategoryScores;
        }
        
        return [
            'success' => true, 
            'data' => [
                'batch' => $batch,
                'rankings' => $rankings,
                'total_count' => count($rankings)
            ]
        ];
        
    } catch (Exception $e) {
        return ['success' => false, 'message' => '获取排名数据失败: ' . $e->getMessage()];
    }
}

// 导出Excel - 详细项目分数版本
function exportBatchRankingToExcel($batchId) {
    $authResult = requireAdmin();
    if (!$authResult['success']) {
        return $authResult;
    }
    
    $pdo = getConnection();
    
    try {
        // 获取批次信息
        $stmt = $pdo->prepare("SELECT * FROM batches WHERE id = ?");
        $stmt->execute([$batchId]);
        $batch = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$batch) {
            return ['success' => false, 'message' => '批次不存在'];
        }
        
        // 获取该批次下所有已审核通过的申请，按总分数排序
        $stmt = $pdo->prepare("
            SELECT 
                a.id,
                a.total_score,
                a.reviewed_at,
                u.real_name,
                u.student_id,
                u.class,
                u.major,
                u.username
            FROM applications a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.batch_id = ? AND a.status = 'approved'
            ORDER BY a.total_score DESC, a.reviewed_at ASC
        ");
        $stmt->execute([$batchId]);
        $rankings = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // 获取所有可能的项目和类目
        $stmt = $pdo->prepare("
            SELECT DISTINCT c.name as category_name, i.name as item_name, c.id as category_id, i.id as item_id
            FROM categories c
            LEFT JOIN items i ON c.id = i.category_id
            ORDER BY c.id, i.id
        ");
        $stmt->execute();
        $allItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // 构建表头
        $headers = [
            '排名', '姓名', '学号', '班级', '专业', '总分', '审核时间'
        ];
        
        // 添加各类目的分数列
        $categoryTotals = [];
        foreach ($allItems as $item) {
            if (!in_array($item['category_name'] . '总分', $headers)) {
                $headers[] = $item['category_name'] . '总分';
                $categoryTotals[] = $item['category_name'];
            }
        }
        
        // 添加每个具体项目的分数列
        $itemColumns = [];
        foreach ($allItems as $item) {
            if ($item['item_name']) {
                $columnName = $item['category_name'] . '-' . $item['item_name'];
                $headers[] = $columnName;
                $itemColumns[] = [
                    'column' => $columnName,
                    'category_id' => $item['category_id'],
                    'item_id' => $item['item_id'],
                    'category_name' => $item['category_name'],
                    'item_name' => $item['item_name']
                ];
            }
        }
        
        // 创建CSV文件
        $csvFileName = '奖学金详细排名_' . $batch['name'] . '_' . date('Y-m-d_H-i-s') . '.csv';
        $csvFilePath = '../excel/' . $csvFileName;
        
        $csvFile = fopen($csvFilePath, 'w');
        
        // 添加BOM以支持中文
        fprintf($csvFile, chr(0xEF).chr(0xBB).chr(0xBF));
        
        // 写入表头
        fputcsv($csvFile, $headers);
        
        // 处理每个学生的数据
        foreach ($rankings as $index => $ranking) {
            $ranking['rank'] = $index + 1;
            
            // 获取该学生的所有申请材料
            $stmt = $pdo->prepare("
                SELECT 
                    am.*,
                    c.name as category_name,
                    i.name as item_name,
                    c.id as category_id,
                    i.id as item_id
                FROM application_materials am
                LEFT JOIN categories c ON am.category_id = c.id
                LEFT JOIN items i ON am.item_id = i.id
                WHERE am.application_id = ?
            ");
            $stmt->execute([$ranking['id']]);
            $materials = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // 构建该学生的数据行
            $row = [
                $ranking['rank'],
                $ranking['real_name'] ?: $ranking['username'],
                $ranking['student_id'] ?: '',
                $ranking['class'] ?: '',
                $ranking['major'] ?: '',
                $ranking['total_score'],
                date('Y-m-d', strtotime($ranking['reviewed_at']))
            ];
            
            // 计算各类目总分
            $categoryScores = [];
            foreach ($materials as $material) {
                $categoryName = $material['category_name'];
                if (!isset($categoryScores[$categoryName])) {
                    $categoryScores[$categoryName] = 0;
                }
                $categoryScores[$categoryName] += $material['score'];
            }
            
            // 添加类目总分列
            foreach ($categoryTotals as $categoryName) {
                $row[] = isset($categoryScores[$categoryName]) ? $categoryScores[$categoryName] : 0;
            }
            
            // 添加每个具体项目的分数
            foreach ($itemColumns as $itemCol) {
                $score = 0;
                foreach ($materials as $material) {
                    if ($material['category_id'] == $itemCol['category_id'] && 
                        $material['item_id'] == $itemCol['item_id']) {
                        $score += $material['score'];
                    }
                }
                $row[] = $score;
            }
            
            fputcsv($csvFile, $row);
        }
        
        fclose($csvFile);
        
        return [
            'success' => true,
            'data' => [
                'file_name' => $csvFileName,
                'file_path' => 'excel/' . $csvFileName,
                'download_url' => 'excel/' . $csvFileName
            ]
        ];
        
    } catch (Exception $e) {
        return ['success' => false, 'message' => '导出Excel失败: ' . $e->getMessage()];
    }
}

// 主要处理逻辑
$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
    case 'getBatchRanking':
        $batchId = $_GET['batch_id'] ?? $_POST['batch_id'] ?? '';
        if (empty($batchId)) {
            echo json_encode(['success' => false, 'message' => '请提供批次ID']);
            exit;
        }
        echo json_encode(getBatchRanking($batchId));
        break;
        
    case 'exportExcel':
        $batchId = $_GET['batch_id'] ?? $_POST['batch_id'] ?? '';
        if (empty($batchId)) {
            echo json_encode(['success' => false, 'message' => '请提供批次ID']);
            exit;
        }
        echo json_encode(exportBatchRankingToExcel($batchId));
        break;
        
    default:
        echo json_encode(['success' => false, 'message' => '无效的操作']);
        break;
}
?> 