-- 添加密码修改功能的数据库更新脚本
-- 执行日期：2024年12月

-- 为用户表添加首次登录标记字段
ALTER TABLE `users` ADD COLUMN `first_login` tinyint(1) NOT NULL DEFAULT 1 AFTER `major`;

-- 为用户表添加密码修改时间字段
ALTER TABLE `users` ADD COLUMN `password_changed_at` timestamp NULL DEFAULT NULL AFTER `first_login`;

-- 将现有的测试用户设置为非首次登录
UPDATE `users` SET `first_login` = 0 WHERE `username` IN ('123', '1234');

-- 为现有的已创建用户添加索引以提高查询性能
ALTER TABLE `users` ADD INDEX `idx_first_login` (`first_login`);

-- 显示更新结果
SELECT username, type, first_login, password_changed_at FROM `users`; 