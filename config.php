<?php
// 数据库配置
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'scholarship_db');
define('DB_USER', 'root');
define('DB_PASS', '');

// 基础配置
define('UPLOAD_PATH', 'uploads/');
define('MAX_FILE_SIZE', 10 * 1024 * 1024); // 10MB

// 错误报告 - 生产环境应关闭
error_reporting(0);
ini_set('display_errors', 0);

// 时区设置
date_default_timezone_set('Asia/Shanghai');
?> 