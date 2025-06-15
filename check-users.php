<?php
require_once 'config.php';

header('Content-Type: text/html; charset=utf-8');

try {
    $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "<h1>数据库用户检查</h1>";
    
    $stmt = $pdo->query("SELECT id, username, type, real_name, created_at FROM users ORDER BY id");
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if ($users) {
        echo "<table border='1' style='border-collapse: collapse; width: 100%;'>";
        echo "<tr><th>ID</th><th>用户名</th><th>类型</th><th>真实姓名</th><th>创建时间</th></tr>";
        foreach ($users as $user) {
            echo "<tr>";
            echo "<td>{$user['id']}</td>";
            echo "<td>{$user['username']}</td>";
            echo "<td><strong>{$user['type']}</strong></td>";
            echo "<td>{$user['real_name']}</td>";
            echo "<td>{$user['created_at']}</td>";
            echo "</tr>";
        }
        echo "</table>";
        
        echo "<h2>发现的问题：</h2>";
        $user123 = array_filter($users, function($u) { return $u['username'] === '123'; });
        $user1234 = array_filter($users, function($u) { return $u['username'] === '1234'; });
        
        if (empty($user123)) {
            echo "<p style='color: red;'>❌ 用户名 '123' 不存在于数据库中</p>";
        } else {
            $user123 = reset($user123);
            echo "<p style='color: green;'>✅ 用户名 '123' 存在，类型为: <strong>{$user123['type']}</strong></p>";
        }
        
        if (empty($user1234)) {
            echo "<p style='color: red;'>❌ 用户名 '1234' 不存在于数据库中</p>";
        } else {
            $user1234 = reset($user1234);
            echo "<p style='color: green;'>✅ 用户名 '1234' 存在，类型为: <strong>{$user1234['type']}</strong></p>";
        }
        
    } else {
        echo "<p style='color: red;'>数据库中没有用户数据</p>";
    }
    
} catch (Exception $e) {
    echo "<p style='color: red;'>错误: " . $e->getMessage() . "</p>";
}
?> 