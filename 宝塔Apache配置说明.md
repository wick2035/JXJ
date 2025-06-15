# 宝塔面板Apache配置指南

## 当前问题解决方案
您的网站 http://113.44.52.71/ 返回404错误，需要正确配置Apache虚拟主机。

## 1. 宝塔面板网站配置

### 步骤一：创建网站
1. 登录宝塔面板
2. 点击 "网站" → "添加站点"
3. 填写信息：
   - 域名：`113.44.52.71`
   - 根目录：`/www/wwwroot/113.44.52.71` 或 `/www/wwwroot/scholarship`
   - PHP版本：选择 PHP 7.4 或以上版本
   - 数据库：选择MySQL，记住数据库信息

### 步骤二：上传文件
1. 将所有项目文件上传到网站根目录
2. 确保文件结构如下：
```
/www/wwwroot/113.44.52.71/
├── index.html
├── install.html
├── install.php
├── database.sql
├── .htaccess
├── api/
│   ├── applications.php
│   ├── auth.php
│   ├── categories.php
│   ├── announcements.php
│   └── upload.php
├── assets/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── main.js
│       └── error-handler.js
└── uploads/
```

### 步骤三：设置权限
在宝塔面板终端中执行：
```bash
# 设置基本权限
chmod -R 755 /www/wwwroot/113.44.52.71/
chmod -R 644 /www/wwwroot/113.44.52.71/*.html
chmod -R 644 /www/wwwroot/113.44.52.71/*.php

# 设置上传目录权限
chmod -R 777 /www/wwwroot/113.44.52.71/uploads/

# 设置所有者
chown -R www:www /www/wwwroot/113.44.52.71/
```

## 2. Apache模块配置

### 确保启用必要模块
在宝塔面板中：
1. 软件商店 → Apache → 设置 → 模块管理
2. 确保以下模块已启用：
   - ✅ mod_rewrite (URL重写)
   - ✅ mod_headers (HTTP头管理)
   - ✅ mod_expires (缓存控制)
   - ✅ mod_deflate (压缩)
   - ✅ mod_php (PHP支持)

### 检查PHP扩展
在宝塔面板中：
1. 软件商店 → PHP → 设置 → 扩展管理
2. 确保启用：
   - ✅ mysqli
   - ✅ json
   - ✅ mbstring
   - ✅ fileinfo

## 3. 虚拟主机配置

### 方法一：通过宝塔面板
1. 网站 → 选择您的站点 → 设置 → 配置文件
2. 在配置文件中添加以下内容：

```apache
<VirtualHost *:80>
    ServerName 113.44.52.71
    DocumentRoot /www/wwwroot/113.44.52.71
    
    <Directory /www/wwwroot/113.44.52.71>
        AllowOverride All
        Require all granted
        DirectoryIndex index.html index.php
    </Directory>
    
    # 错误日志
    ErrorLog /www/wwwroot/113.44.52.71/logs/error.log
    CustomLog /www/wwwroot/113.44.52.71/logs/access.log combined
</VirtualHost>
```

### 方法二：使用.htaccess（推荐）
项目中的 `.htaccess` 文件已经包含所有必要配置，确保：
1. 文件存在于网站根目录
2. Apache已启用 `mod_rewrite` 模块
3. 虚拟主机配置允许 `AllowOverride All`

## 4. 数据库配置

1. 在宝塔面板中创建数据库：
   - 数据库名：`scholarship_db`
   - 用户名：创建专用用户
   - 密码：设置强密码

2. 记录数据库信息，在系统安装时使用

## 5. SSL配置（可选）

如果需要HTTPS：
1. 网站 → SSL → 自签证书或Let's Encrypt
2. 强制HTTPS

## 6. 测试访问

配置完成后测试：
- 主页：http://113.44.52.71/
- 安装页面：http://113.44.52.71/install
- API测试：http://113.44.52.71/install.php?action=check_env

## 7. 常见问题解决

### 404错误
- 检查DocumentRoot路径是否正确
- 确认index.html文件存在
- 验证Apache配置语法

### 403错误
- 检查文件权限：`ls -la /www/wwwroot/113.44.52.71/`
- 确保目录权限为755，文件权限为644

### PHP不执行
- 检查PHP模块是否启用
- 验证.htaccess中的PHP处理规则

### 上传失败
- 检查uploads目录权限：`chmod 777 uploads/`
- 确认PHP上传限制设置

## 8. 宝塔面板快速命令

```bash
# 重启Apache
/etc/init.d/httpd restart

# 检查Apache状态
systemctl status httpd

# 查看错误日志
tail -f /www/wwwroot/113.44.52.71/logs/error.log

# 测试Apache配置
httpd -t
```

## 9. 性能优化

1. 启用Gzip压缩（已在.htaccess中配置）
2. 设置静态资源缓存（已配置）
3. 开启Apache缓存模块

完成以上配置后，您的网站应该能够正常访问。 