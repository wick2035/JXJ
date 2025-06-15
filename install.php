<?php
header('Content-Type: application/json');

// 安装配置
$configFile = 'config.php';
$installLockFile = 'install.lock';

// 检查是否已安装
function isInstalled() {
    global $installLockFile;
    return file_exists($installLockFile);
}

// 环境检测
function checkEnvironment() {
    $checks = [];
    
    // PHP版本检测
    $phpVersion = phpversion();
    $checks[] = [
        'name' => 'PHP版本',
        'status' => version_compare($phpVersion, '7.4.0', '>='),
        'message' => $phpVersion >= '7.4.0' ? "PHP $phpVersion (符合要求)" : "PHP $phpVersion (需要7.4.0以上)"
    ];
    
    // 扩展检测
    $extensions = ['mysqli', 'json', 'mbstring', 'fileinfo'];
    foreach ($extensions as $ext) {
        $checks[] = [
            'name' => "PHP扩展 $ext",
            'status' => extension_loaded($ext),
            'message' => extension_loaded($ext) ? '已安装' : '未安装'
        ];
    }
    
    // 目录权限检测
    $dirs = ['uploads', '.'];
    foreach ($dirs as $dir) {
        if (!file_exists($dir)) {
            @mkdir($dir, 0755, true);
        }
        $writable = is_writable($dir);
        $checks[] = [
            'name' => "目录权限 $dir",
            'status' => $writable,
            'message' => $writable ? '可写' : '不可写'
        ];
    }
    
    return $checks;
}

// 测试数据库连接
function testDatabase($host, $port, $name, $user, $pass) {
    try {
        $dsn = "mysql:host=$host;port=$port;charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        
        // 检查数据库是否存在，不存在则创建
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `$name` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        
        return ['success' => true, 'message' => '连接成功'];
    } catch (PDOException $e) {
        return ['success' => false, 'message' => $e->getMessage()];
    }
}

// 保存配置文件
function saveConfig($host, $port, $name, $user, $pass) {
    global $configFile;
    
    $configContent = "<?php
// 数据库配置
define('DB_HOST', '$host');
define('DB_PORT', '$port');
define('DB_NAME', '$name');
define('DB_USER', '$user');
define('DB_PASS', '$pass');

// 基础配置
define('UPLOAD_PATH', 'uploads/');
define('MAX_FILE_SIZE', 10 * 1024 * 1024); // 10MB

// 错误报告
error_reporting(E_ALL);
ini_set('display_errors', 0);

// 时区设置
date_default_timezone_set('Asia/Shanghai');
?>";
    
    if (file_put_contents($configFile, $configContent)) {
        return ['success' => true, 'message' => '配置保存成功'];
    } else {
        return ['success' => false, 'message' => '配置文件写入失败'];
    }
}

// 安装数据库
function installDatabase() {
    global $configFile;
    
    if (!file_exists($configFile)) {
        return ['success' => false, 'message' => '配置文件不存在'];
    }
    
    require_once $configFile;
    
    try {
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $pdo = new PDO($dsn, DB_USER, DB_PASS);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        
        // 执行数据库结构
        $sql = file_get_contents('database.sql');
        $statements = explode(';', $sql);
        
        foreach ($statements as $statement) {
            $statement = trim($statement);
            if (!empty($statement)) {
                $pdo->exec($statement);
            }
        }
        
        return ['success' => true, 'message' => '数据库安装成功'];
    } catch (PDOException $e) {
        return ['success' => false, 'message' => '数据库安装失败: ' . $e->getMessage()];
    }
}

// 完成安装
function completeInstall() {
    global $installLockFile;
    
    // 创建安装锁文件
    if (file_put_contents($installLockFile, date('Y-m-d H:i:s'))) {
        return ['success' => true, 'message' => '安装完成'];
    } else {
        return ['success' => false, 'message' => '无法创建安装锁文件'];
    }
}

// 处理请求
$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
    case 'check_install':
        echo json_encode(['installed' => isInstalled()]);
        break;
        
    case 'check_env':
        $checks = checkEnvironment();
        echo json_encode(['checks' => $checks]);
        break;
        
    case 'test_db':
        $result = testDatabase(
            $_POST['host'],
            $_POST['port'],
            $_POST['name'],
            $_POST['user'],
            $_POST['pass']
        );
        echo json_encode($result);
        break;
        
    case 'save_config':
        $result = saveConfig(
            $_POST['host'],
            $_POST['port'],
            $_POST['name'],
            $_POST['user'],
            $_POST['pass']
        );
        echo json_encode($result);
        break;
        
    case 'install':
        $dbResult = installDatabase();
        if ($dbResult['success']) {
            $installResult = completeInstall();
            echo json_encode($installResult);
        } else {
            echo json_encode($dbResult);
        }
        break;
        
    default:
        echo json_encode(['success' => false, 'message' => '未知操作']);
        break;
}
?> 