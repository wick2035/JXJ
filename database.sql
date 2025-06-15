-- 奖学金评定系统数据库结构

-- 用户表
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `type` enum('student','admin') NOT NULL DEFAULT 'student',
  `real_name` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `student_id` varchar(20) DEFAULT NULL,
  `class` varchar(50) DEFAULT NULL,
  `major` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 公告表
CREATE TABLE `announcements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `content` text NOT NULL,
  `type` enum('normal','important','urgent') NOT NULL DEFAULT 'normal',
  `is_active` tinyint(1) NOT NULL DEFAULT 0,
  `publish_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_active` (`is_active`),
  KEY `idx_publish_time` (`publish_time`),
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 奖学金批次表
CREATE TABLE `batches` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `description` text,
  `status` enum('open','closed') NOT NULL DEFAULT 'open',
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 类目表
CREATE TABLE `categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `score` int(11) NOT NULL DEFAULT 0,
  `description` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 奖项表
CREATE TABLE `items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `category_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category_id`),
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 奖项分数配置表
CREATE TABLE `item_scores` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `item_id` int(11) NOT NULL,
  `level` enum('national','provincial','municipal','university','college','ungraded') NOT NULL,
  `grade` enum('first','second','third','none') NOT NULL,
  `score` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_item_level_grade` (`item_id`,`level`,`grade`),
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 申请表
CREATE TABLE `applications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `batch_id` int(11) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `total_score` decimal(10,2) DEFAULT 0.00,
  `review_comment` text,
  `submitted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `reviewed_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_batch` (`user_id`,`batch_id`),
  KEY `idx_status` (`status`),
  KEY `idx_batch` (`batch_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 申请材料表
CREATE TABLE `application_materials` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `application_id` int(11) NOT NULL,
  `category_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `award_level` enum('national','provincial','municipal','university','college','ungraded') NOT NULL,
  `award_grade` enum('first','second','third','none') NOT NULL,
  `score` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_application` (`application_id`),
  KEY `idx_category` (`category_id`),
  KEY `idx_item` (`item_id`),
  FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 上传文件表
CREATE TABLE `uploaded_files` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `material_id` int(11) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size` bigint(20) NOT NULL,
  `file_type` varchar(100) NOT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_material` (`material_id`),
  FOREIGN KEY (`material_id`) REFERENCES `application_materials`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认用户
INSERT INTO `users` (`username`, `password`, `type`, `real_name`) VALUES
('123', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', '学生用户'),
('1234', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', '管理员');

-- 插入默认批次
INSERT INTO `batches` (`name`, `description`, `status`, `start_date`, `end_date`) VALUES
('2025年春季奖学金评定', '2025年春季学期奖学金评定', 'open', '2025-06-01', '2025-07-15'),
('2025年夏季奖学金评定', '2025年夏季学期奖学金评定', 'open', '2025-06-15', '2025-07-20'),
('2024年冬季奖学金评定', '2024年冬季学期奖学金评定', 'closed', '2024-12-01', '2025-01-15');

-- 插入默认类目
INSERT INTO `categories` (`name`, `score`, `description`) VALUES
('德育', 30, '思想品德、道德修养相关奖项'),
('能力', 40, '学科竞赛、科技创新等能力类奖项'),
('体育', 20, '体育竞赛、运动会等体育类奖项'),
('其他材料', 10, '推荐信、证明材料等其他类别');

-- 插入默认奖项
INSERT INTO `items` (`category_id`, `name`, `description`) VALUES
(1, '优干', '优秀学生干部'),
(1, '优秀共青团员', '优秀共青团员称号'),
(1, '积极分子', '入党积极分子'),
(2, '美赛', '美国大学生数学建模竞赛'),
(2, '电工杯', '全国大学生数学建模竞赛'),
(2, '蓝桥杯', '蓝桥杯全国软件和信息技术专业人才大赛'),
(3, '体育竞赛', '各类体育竞赛奖项'),
(3, '阳光运动会', '阳光体育运动会'),
(4, '推荐信', '导师或教师推荐信');

-- 插入默认分数配置（德育类）
INSERT INTO `item_scores` (`item_id`, `level`, `grade`, `score`) VALUES
-- 优干
(1, 'national', 'first', 25), (1, 'national', 'second', 20), (1, 'national', 'third', 15), (1, 'national', 'none', 18),
(1, 'provincial', 'first', 20), (1, 'provincial', 'second', 16), (1, 'provincial', 'third', 12), (1, 'provincial', 'none', 14),
(1, 'municipal', 'first', 15), (1, 'municipal', 'second', 12), (1, 'municipal', 'third', 9), (1, 'municipal', 'none', 11),
(1, 'university', 'first', 10), (1, 'university', 'second', 8), (1, 'university', 'third', 6), (1, 'university', 'none', 7),
(1, 'college', 'first', 8), (1, 'college', 'second', 6), (1, 'college', 'third', 4), (1, 'college', 'none', 5),
(1, 'ungraded', 'first', 5), (1, 'ungraded', 'second', 4), (1, 'ungraded', 'third', 3), (1, 'ungraded', 'none', 4),

-- 优秀共青团员
(2, 'national', 'first', 20), (2, 'national', 'second', 16), (2, 'national', 'third', 12), (2, 'national', 'none', 14),
(2, 'provincial', 'first', 16), (2, 'provincial', 'second', 13), (2, 'provincial', 'third', 10), (2, 'provincial', 'none', 11),
(2, 'municipal', 'first', 12), (2, 'municipal', 'second', 10), (2, 'municipal', 'third', 8), (2, 'municipal', 'none', 9),
(2, 'university', 'first', 8), (2, 'university', 'second', 6), (2, 'university', 'third', 5), (2, 'university', 'none', 6),
(2, 'college', 'first', 6), (2, 'college', 'second', 5), (2, 'college', 'third', 4), (2, 'college', 'none', 4),
(2, 'ungraded', 'first', 4), (2, 'ungraded', 'second', 3), (2, 'ungraded', 'third', 2), (2, 'ungraded', 'none', 3),

-- 积极分子
(3, 'national', 'first', 15), (3, 'national', 'second', 12), (3, 'national', 'third', 9), (3, 'national', 'none', 10),
(3, 'provincial', 'first', 12), (3, 'provincial', 'second', 10), (3, 'provincial', 'third', 8), (3, 'provincial', 'none', 9),
(3, 'municipal', 'first', 9), (3, 'municipal', 'second', 7), (3, 'municipal', 'third', 6), (3, 'municipal', 'none', 7),
(3, 'university', 'first', 6), (3, 'university', 'second', 5), (3, 'university', 'third', 4), (3, 'university', 'none', 4),
(3, 'college', 'first', 4), (3, 'college', 'second', 3), (3, 'college', 'third', 2), (3, 'college', 'none', 3),
(3, 'ungraded', 'first', 3), (3, 'ungraded', 'second', 2), (3, 'ungraded', 'third', 1), (3, 'ungraded', 'none', 2);

-- 插入能力类奖项分数配置
INSERT INTO `item_scores` (`item_id`, `level`, `grade`, `score`) VALUES
-- 美赛
(4, 'national', 'first', 40), (4, 'national', 'second', 32), (4, 'national', 'third', 24), (4, 'national', 'none', 28),
(4, 'provincial', 'first', 32), (4, 'provincial', 'second', 26), (4, 'provincial', 'third', 20), (4, 'provincial', 'none', 23),
(4, 'municipal', 'first', 24), (4, 'municipal', 'second', 19), (4, 'municipal', 'third', 15), (4, 'municipal', 'none', 17),
(4, 'university', 'first', 16), (4, 'university', 'second', 13), (4, 'university', 'third', 10), (4, 'university', 'none', 12),
(4, 'college', 'first', 12), (4, 'college', 'second', 10), (4, 'college', 'third', 8), (4, 'college', 'none', 9),
(4, 'ungraded', 'first', 8), (4, 'ungraded', 'second', 6), (4, 'ungraded', 'third', 5), (4, 'ungraded', 'none', 6),

-- 电工杯
(5, 'national', 'first', 35), (5, 'national', 'second', 28), (5, 'national', 'third', 21), (5, 'national', 'none', 25),
(5, 'provincial', 'first', 28), (5, 'provincial', 'second', 22), (5, 'provincial', 'third', 17), (5, 'provincial', 'none', 20),
(5, 'municipal', 'first', 21), (5, 'municipal', 'second', 17), (5, 'municipal', 'third', 13), (5, 'municipal', 'none', 15),
(5, 'university', 'first', 14), (5, 'university', 'second', 11), (5, 'university', 'third', 9), (5, 'university', 'none', 10),
(5, 'college', 'first', 10), (5, 'college', 'second', 8), (5, 'college', 'third', 6), (5, 'college', 'none', 7),
(5, 'ungraded', 'first', 7), (5, 'ungraded', 'second', 5), (5, 'ungraded', 'third', 4), (5, 'ungraded', 'none', 5),

-- 蓝桥杯
(6, 'national', 'first', 30), (6, 'national', 'second', 24), (6, 'national', 'third', 18), (6, 'national', 'none', 21),
(6, 'provincial', 'first', 24), (6, 'provincial', 'second', 19), (6, 'provincial', 'third', 15), (6, 'provincial', 'none', 17),
(6, 'municipal', 'first', 18), (6, 'municipal', 'second', 14), (6, 'municipal', 'third', 11), (6, 'municipal', 'none', 13),
(6, 'university', 'first', 12), (6, 'university', 'second', 10), (6, 'university', 'third', 8), (6, 'university', 'none', 9),
(6, 'college', 'first', 9), (6, 'college', 'second', 7), (6, 'college', 'third', 5), (6, 'college', 'none', 6),
(6, 'ungraded', 'first', 6), (6, 'ungraded', 'second', 4), (6, 'ungraded', 'third', 3), (6, 'ungraded', 'none', 4);

-- 插入体育类奖项分数配置
INSERT INTO `item_scores` (`item_id`, `level`, `grade`, `score`) VALUES
-- 体育竞赛
(7, 'national', 'first', 25), (7, 'national', 'second', 20), (7, 'national', 'third', 15), (7, 'national', 'none', 18),
(7, 'provincial', 'first', 20), (7, 'provincial', 'second', 16), (7, 'provincial', 'third', 12), (7, 'provincial', 'none', 14),
(7, 'municipal', 'first', 15), (7, 'municipal', 'second', 12), (7, 'municipal', 'third', 9), (7, 'municipal', 'none', 11),
(7, 'university', 'first', 10), (7, 'university', 'second', 8), (7, 'university', 'third', 6), (7, 'university', 'none', 7),
(7, 'college', 'first', 8), (7, 'college', 'second', 6), (7, 'college', 'third', 4), (7, 'college', 'none', 5),
(7, 'ungraded', 'first', 5), (7, 'ungraded', 'second', 4), (7, 'ungraded', 'third', 3), (7, 'ungraded', 'none', 4),

-- 阳光运动会
(8, 'national', 'first', 15), (8, 'national', 'second', 12), (8, 'national', 'third', 9), (8, 'national', 'none', 10),
(8, 'provincial', 'first', 12), (8, 'provincial', 'second', 10), (8, 'provincial', 'third', 8), (8, 'provincial', 'none', 9),
(8, 'municipal', 'first', 9), (8, 'municipal', 'second', 7), (8, 'municipal', 'third', 6), (8, 'municipal', 'none', 7),
(8, 'university', 'first', 6), (8, 'university', 'second', 5), (8, 'university', 'third', 4), (8, 'university', 'none', 4),
(8, 'college', 'first', 4), (8, 'college', 'second', 3), (8, 'college', 'third', 2), (8, 'college', 'none', 3),
(8, 'ungraded', 'first', 3), (8, 'ungraded', 'second', 2), (8, 'ungraded', 'third', 1), (8, 'ungraded', 'none', 2);

-- 插入其他类奖项分数配置
INSERT INTO `item_scores` (`item_id`, `level`, `grade`, `score`) VALUES
-- 推荐信
(9, 'national', 'first', 8), (9, 'national', 'second', 6), (9, 'national', 'third', 5), (9, 'national', 'none', 6),
(9, 'provincial', 'first', 6), (9, 'provincial', 'second', 5), (9, 'provincial', 'third', 4), (9, 'provincial', 'none', 5),
(9, 'municipal', 'first', 5), (9, 'municipal', 'second', 4), (9, 'municipal', 'third', 3), (9, 'municipal', 'none', 4),
(9, 'university', 'first', 4), (9, 'university', 'second', 3), (9, 'university', 'third', 2), (9, 'university', 'none', 3),
(9, 'college', 'first', 3), (9, 'college', 'second', 2), (9, 'college', 'third', 1), (9, 'college', 'none', 2),
(9, 'ungraded', 'first', 2), (9, 'ungraded', 'second', 1), (9, 'ungraded', 'third', 1), (9, 'ungraded', 'none', 1);

-- 插入默认公告
INSERT INTO `announcements` (`title`, `content`, `type`, `is_active`, `created_by`) VALUES
('2025年春季奖学金评定开始通知', '各位同学：\n\n2025年春季奖学金评定工作正式开始，请大家注意以下几点：\n\n1. 申请截止时间：2025年7月15日\n2. 请确保所有材料完整、真实有效\n3. 如有疑问请及时联系管理员\n4. 材料提交后请耐心等待审核结果\n\n祝大家申请顺利！', 'important', 1, 2); 