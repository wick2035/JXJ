// 奖学金评定系统 - 主要JavaScript文件
// 连接前端界面到后端API

// 全局变量
let currentUser = null;
let currentApplication = null;
let categories = [];
let batches = [];
let announcements = [];

// 奖项等级和级别定义
const awardLevels = ['national', 'provincial', 'municipal', 'university', 'college', 'ungraded'];
const awardGrades = ['first', 'second', 'third', 'none'];

const levelNames = {
    'national': '国家级',
    'provincial': '省级', 
    'municipal': '市级',
    'university': '校级',
    'college': '院级',
    'ungraded': '非分级奖项'
};

const gradeNames = {
    'first': '一等奖',
    'second': '二等奖',
    'third': '三等奖',
    'none': '无等级'
};

// API 调用工具函数
class ApiClient {
    static async request(url, options = {}) {
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin'
        };

        const config = { ...defaultOptions, ...options };
        
        if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    static async get(url) {
        return this.request(url);
    }

    static async post(url, data) {
        return this.request(url, {
            method: 'POST',
            body: data
        });
    }

    static async put(url, data) {
        return this.request(url, {
            method: 'PUT',
            body: data
        });
    }

    static async delete(url) {
        return this.request(url, {
            method: 'DELETE'
        });
    }
}

// 认证相关函数
class AuthManager {
    static async login(username, password) {
        try {
            // 使用FormData代替JSON对象
            const formData = new FormData();
            formData.append('action', 'login');
            formData.append('username', username);
            formData.append('password', password);
            
            const response = await fetch('api/auth.php', {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
            });
            
            const data = await response.json();
            
            if (data.success) {
                currentUser = data.user;
                return data.user;
            } else {
                throw new Error(data.message || '登录失败');
            }
        } catch (error) {
            throw error;
        }
    }

    static async logout() {
        try {
            const formData = new FormData();
            formData.append('action', 'logout');
            
            await fetch('api/auth.php', {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
            });
            currentUser = null;
        } catch (error) {
            console.error('Logout error:', error);
            currentUser = null;
        }
    }

    static async checkAuth() {
        try {
            const response = await fetch('api/auth.php?action=check', {
                method: 'GET',
                credentials: 'same-origin'
            });
            const data = await response.json();
            if (data.success && data.user) {
                currentUser = data.user;
                return data.user;
            }
            return null;
        } catch (error) {
            console.error('Auth check error:', error);
            return null;
        }
    }
}

// 数据管理类
class DataManager {
    static async loadCategories() {
        try {
            const response = await fetch('api/categories.php?action=list_with_items', {
                method: 'GET',
                credentials: 'same-origin'
            });
            const data = await response.json();
            if (data.success) {
                categories = data.categories || data.data || [];
                return categories;
            }
            throw new Error(data.message || '加载类目失败');
        } catch (error) {
            console.error('Load categories error:', error);
            throw error;
        }
    }

    static async loadBatches() {
        try {
            const response = await fetch('api/applications.php?action=getBatches', {
                method: 'GET',
                credentials: 'same-origin'
            });
            const data = await response.json();
            if (data.success) {
                batches = data.batches || data.data || [];
                return batches;
            }
            throw new Error(data.message || '加载批次失败');
        } catch (error) {
            console.error('Load batches error:', error);
            throw error;
        }
    }

    static async loadAnnouncements() {
        try {
            const response = await fetch('api/announcements.php?action=list', {
                method: 'GET',
                credentials: 'same-origin'
            });
            const data = await response.json();
            if (data.success) {
                announcements = data.announcements || data.data || [];
                return announcements;
            }
            throw new Error(data.message || '加载公告失败');
        } catch (error) {
            console.error('Load announcements error:', error);
            throw error;
        }
    }
}

// 登录表单处理
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const btn = this.querySelector('.login-btn');
    
    btn.textContent = '登录中...';
    btn.style.opacity = '0.7';
    btn.disabled = true;
    
    try {
        const user = await AuthManager.login(username, password);
        
        // 加载基础数据
        await Promise.all([
            DataManager.loadCategories(),
            DataManager.loadBatches(),
            DataManager.loadAnnouncements()
        ]);
        
        setTimeout(() => {
            hideAllPages();
            if (user.type === 'student') {
                showStudentPage();
                // 学生登录后显示公告
                if (shouldShowAnnouncementOnLogin()) {
                    setTimeout(() => {
                        const activeAnnouncement = announcements.find(ann => ann.is_active);
                        if (activeAnnouncement) {
                            showAnnouncementModal();
                        }
                    }, 1000);
                }
            } else {
                showAdminPage();
            }
        }, 1000);
        
    } catch (error) {
        alert(error.message || '登录失败！');
        btn.textContent = '登录系统';
        btn.style.opacity = '1';
        btn.disabled = false;
    }
});

// 页面切换函数
function hideAllPages() {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
}

function showStudentPage() {
    hideAllPages();
    document.getElementById('studentPage').classList.add('active');
    renderBatchList();
    renderMyApplications();
}

function showAdminPage() {
    hideAllPages();
    document.getElementById('adminPage').classList.add('active');
    updateStats();
    updateCategorySelect();
    renderItemsList();
    renderCategoryList();
    renderStudentMaterials();
    renderAnnouncementHistory();
    loadUsersList();
}

function showApplicationPage(batchId, applicationId = null) {
    const batch = batches.find(b => b.id === batchId);
    
    if (!applicationId && batch.status === 'closed') {
        alert('该批次已截止申报！');
        return;
    }
    
    hideAllPages();
    document.getElementById('applicationPage').classList.add('active');
    document.getElementById('currentBatchTitle').textContent = batch.name;
    document.getElementById('currentBatchTitle').dataset.batchId = batchId;
    
    if (applicationId) {
        loadApplicationForEdit(applicationId);
        document.getElementById('submitBtn').textContent = '更新申请';
    } else {
        currentApplication = null;
        document.getElementById('submitBtn').textContent = '提交申请';
    }
    
    renderCategories(batchId);
}

async function logout() {
    await AuthManager.logout();
    currentUser = null;
    currentApplication = null;
    hideAllPages();
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('loginForm').reset();
    document.querySelector('.login-btn').textContent = '登录系统';
    document.querySelector('.login-btn').style.opacity = '1';
    document.querySelector('.login-btn').disabled = false;
}

// 初始化检查认证状态
document.addEventListener('DOMContentLoaded', async function() {
    try {
        const user = await AuthManager.checkAuth();
        if (user) {
            currentUser = user;
            await Promise.all([
                DataManager.loadCategories(),
                DataManager.loadBatches(),
                DataManager.loadAnnouncements()
            ]);
            
            hideAllPages();
            if (user.type === 'student') {
                showStudentPage();
            } else {
                showAdminPage();
            }
        }
    } catch (error) {
        console.error('Auth check failed:', error);
    }
    
    // 设置拖拽事件
    document.addEventListener('dragover', function(e) {
        e.preventDefault();
    });
    
    document.addEventListener('drop', function(e) {
        e.preventDefault();
    });

    // 点击模态框外部关闭公告
    document.getElementById('announcementModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeAnnouncementModal();
        }
    });

    // 用户管理相关事件监听器
    const userTypeSelect = document.getElementById('userType');
    if (userTypeSelect) {
        userTypeSelect.addEventListener('change', function() {
            const studentFields = document.getElementById('studentFields');
            if (this.value === 'student') {
                studentFields.style.display = 'flex';
            } else {
                studentFields.style.display = 'none';
            }
        });
    }

    // 编辑用户类型切换
    const editUserTypeSelect = document.getElementById('editUserType');
    if (editUserTypeSelect) {
        editUserTypeSelect.addEventListener('change', function() {
            const studentFields = document.getElementById('editStudentFields');
            if (this.value === 'student') {
                studentFields.style.display = 'flex';
            } else {
                studentFields.style.display = 'none';
            }
        });
    }

    // 用户表单提交
    const userForm = document.getElementById('userForm');
    if (userForm) {
        userForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await addUser();
        });
    }

    // 点击编辑用户弹窗外部关闭
    document.getElementById('editUserModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeEditUserModal();
        }
    });
});

// 批次和申请管理
async function renderBatchList() {
    const container = document.getElementById('batchList');
    container.innerHTML = '';
    
    try {
        await DataManager.loadBatches();
        
        batches.forEach(batch => {
            const batchEl = document.createElement('div');
            batchEl.className = 'batch-item';
            
            batchEl.onclick = () => {
                showApplicationPage(batch.id);
            };
            
            const statusText = batch.status === 'open' ? '申报中' : '已截止';
            const statusClass = batch.status === 'open' ? 'status-open' : 'status-closed';
            
            batchEl.innerHTML = `
                <div class="batch-title">${batch.name}</div>
                <div class="batch-info">截止日期: ${batch.deadline}</div>
                <div>
                    <span class="batch-status ${statusClass}">${statusText}</span>
                </div>
            `;
            
            if (batch.status === 'closed') {
                batchEl.style.opacity = '0.6';
                batchEl.style.cursor = 'default';
                batchEl.onclick = null;
            }
            
            container.appendChild(batchEl);
        });
        
    } catch (error) {
        console.error('Error rendering batch list:', error);
        container.innerHTML = '<div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 40px;">加载批次失败</div>';
    }
}

async function renderMyApplications() {
    const container = document.getElementById('myApplicationsList');
    container.innerHTML = '';
    
    try {
        const response = await ApiClient.get('api/applications.php?action=getMyApplications');
        
        if (response.success && response.applications.length > 0) {
            response.applications.forEach(application => {
                const applicationEl = document.createElement('div');
                applicationEl.className = 'application-item';
                
                const statusText = {
                    'pending': '待审核',
                    'approved': '已通过',
                    'rejected': '已驳回'
                };
                
                const statusClass = `status-${application.status}`;
                
                applicationEl.innerHTML = `
                    <div class="application-title">${application.batch_name}</div>
                    <div class="application-info">
                        提交时间: ${formatDate(application.submit_time)}
                        ${application.review_comment ? '<br>审核意见: ' + application.review_comment : ''}
                    </div>
                    <div class="action-buttons">
                        <span class="application-status ${statusClass}">
                            ${statusText[application.status]}
                        </span>
                        ${(application.status === 'pending' || application.status === 'rejected') ? 
                            `<button class="btn-warning btn" onclick="showApplicationPage(${application.batch_id}, ${application.id})">修改申请</button>` : 
                            ''
                        }
                        <button class="btn-outline btn" onclick="viewApplication(${application.id})">查看详情</button>
                    </div>
                `;
                
                container.appendChild(applicationEl);
            });
        } else {
            container.innerHTML = '<div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 40px;">暂无申请记录</div>';
        }
        
    } catch (error) {
        console.error('Error rendering applications:', error);
        container.innerHTML = '<div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 40px;">加载申请失败</div>';
    }
}

async function loadApplicationForEdit(applicationId) {
    try {
        const response = await ApiClient.get(`api/applications.php?action=getApplication&id=${applicationId}`);
        if (response.success) {
            currentApplication = response.application;
            if (currentApplication.status === 'approved') {
                alert('已通过的申请不能修改！');
                showStudentPage();
                return;
            }
        }
    } catch (error) {
        console.error('Error loading application:', error);
        alert('加载申请失败！');
        showStudentPage();
    }
}

async function viewApplication(applicationId) {
    try {
        const response = await ApiClient.get(`api/applications.php?action=getApplication&id=${applicationId}`);
        if (response.success) {
            const application = response.application;
            
            let materialsInfo = '';
            let totalScore = 0;
            
            if (application.materials) {
                application.materials.forEach(material => {
                    materialsInfo += `\n【${material.category_name}】:\n`;
                    materialsInfo += `  ${material.item_name} - ${levelNames[material.award_level]} ${gradeNames[material.award_grade]} (${material.score}分)\n`;
                    totalScore += material.score;
                });
            }
            
            const statusText = {
                'pending': '待审核',
                'approved': '已通过',
                'rejected': '已驳回'
            };
            
            alert(`申请详情：
批次：${application.batch_name}
状态：${statusText[application.status]}
提交时间：${formatDate(application.submit_time)}
申报项目：${materialsInfo || '\n无'}
预计总分：${totalScore}分
${application.review_comment ? '\n审核意见：' + application.review_comment : ''}`);
        }
    } catch (error) {
        console.error('Error viewing application:', error);
        alert('查看申请失败！');
    }
}

// 工具函数
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 申请表单管理
function renderCategories(batchId) {
    const container = document.getElementById('categoriesContainer');
    container.innerHTML = '';
    
    categories.forEach(category => {
        const categoryEl = document.createElement('div');
        categoryEl.className = 'category-section';
        
        categoryEl.innerHTML = `
            <div class="category-title">${category.name}</div>
            <div class="category-score">总分权重: ${category.score}分</div>
            
            <div id="itemsContainer${category.id}">
                <!-- 已添加的奖项将在这里显示 -->
            </div>
            
            <button class="btn-outline btn" onclick="addNewItem(${category.id})" style="width: 100%; margin-top: 15px;">
                ➕ 添加${category.name}奖项
            </button>
        `;
        
        container.appendChild(categoryEl);
    });
    
    // 如果是编辑模式，加载已有数据
    if (currentApplication && currentApplication.materials) {
        currentApplication.materials.forEach((material, index) => {
            addItemToCategory(material.category_id, material, index);
        });
    }
}

function addNewItem(categoryId) {
    const category = categories.find(c => c.id === categoryId);
    let itemOptions = '<option value="">请选择具体项目</option>';
    category.items.forEach(item => {
        itemOptions += `<option value="${item.id}">${item.name}</option>`;
    });
    
    const itemIndex = Date.now();
    addItemToCategory(categoryId, null, itemIndex, itemOptions);
}

function addItemToCategory(categoryId, itemData = null, itemIndex, itemOptions = null) {
    const container = document.getElementById(`itemsContainer${categoryId}`);
    const category = categories.find(c => c.id === categoryId);
    
    if (!itemOptions) {
        itemOptions = '<option value="">请选择具体项目</option>';
        category.items.forEach(item => {
            itemOptions += `<option value="${item.id}">${item.name}</option>`;
        });
    }
    
    // 级别和等级选项
    let levelOptions = '';
    awardLevels.forEach(level => {
        levelOptions += `<option value="${level}">${levelNames[level]}</option>`;
    });
    
    let gradeOptions = '';
    awardGrades.forEach(grade => {
        gradeOptions += `<option value="${grade}">${gradeNames[grade]}</option>`;
    });
    
    const itemEl = document.createElement('div');
    itemEl.className = 'item-entry';
    itemEl.id = `itemEntry${categoryId}_${itemIndex}`;
    
    itemEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h4 style="color: white; margin: 0;">奖项 #${container.children.length + 1}</h4>
            <button class="file-remove" onclick="removeItemEntry(${categoryId}, ${itemIndex})">删除奖项</button>
        </div>
        
        <div class="form-group" style="margin-bottom: 15px;">
            <label class="form-label">选择具体项目</label>
            <select id="itemSelect${categoryId}_${itemIndex}" class="form-select" onchange="updateItemSelection(${categoryId}, ${itemIndex})">
                ${itemOptions}
            </select>
        </div>
        
        <div class="form-row-double">
            <div class="form-group">
                <label class="form-label">奖项级别</label>
                <select id="levelSelect${categoryId}_${itemIndex}" class="form-select" onchange="updateScoreCalculation(${categoryId}, ${itemIndex})">
                    ${levelOptions}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">奖项等级</label>
                <select id="gradeSelect${categoryId}_${itemIndex}" class="form-select" onchange="updateScoreCalculation(${categoryId}, ${itemIndex})">
                    ${gradeOptions}
                </select>
            </div>
        </div>
        
        <div id="selectedItemInfo${categoryId}_${itemIndex}" style="margin-bottom: 15px; display: none;">
            <div style="background: rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 8px;">
                <div style="color: white; font-weight: 500; margin-bottom: 8px;">已选择: <span id="itemInfoText${categoryId}_${itemIndex}" style="color: #fbbf24;"></span></div>
                <div style="color: rgba(255, 255, 255, 0.8); font-size: 14px;">
                    <span style="color: #22c55e; font-weight: bold; font-size: 16px;">得分: <span id="finalScore${categoryId}_${itemIndex}">0</span>分</span>
                </div>
            </div>
        </div>
        
        <div class="file-upload" onclick="selectFilesForItem(${categoryId}, ${itemIndex})" id="fileUpload${categoryId}_${itemIndex}">
            <div class="upload-icon">📁</div>
            <div class="upload-text">点击上传证明材料<br>支持 JPG、PNG、PDF 格式</div>
            <input type="file" id="fileInput${categoryId}_${itemIndex}" multiple accept="image/*,.pdf" style="display: none;" onchange="handleItemFileSelect(${categoryId}, ${itemIndex}, this)">
        </div>
        <div class="file-list" id="fileList${categoryId}_${itemIndex}"></div>
    `;
    
    container.appendChild(itemEl);
    
    // 如果有数据，填充表单
    if (itemData) {
        const itemSelect = document.getElementById(`itemSelect${categoryId}_${itemIndex}`);
        const levelSelect = document.getElementById(`levelSelect${categoryId}_${itemIndex}`);
        const gradeSelect = document.getElementById(`gradeSelect${categoryId}_${itemIndex}`);
        
        if (itemData.item_id) {
            itemSelect.value = itemData.item_id;
        }
        if (itemData.award_level) {
            levelSelect.value = itemData.award_level;
        }
        if (itemData.award_grade) {
            gradeSelect.value = itemData.award_grade;
        }
        
        updateItemSelection(categoryId, itemIndex);
        updateScoreCalculation(categoryId, itemIndex);
        
        // 加载已有文件
        if (itemData.files) {
            loadExistingFiles(categoryId, itemIndex, itemData.files);
        }
    } else {
        // 设置默认值
        document.getElementById(`levelSelect${categoryId}_${itemIndex}`).value = 'ungraded';
        document.getElementById(`gradeSelect${categoryId}_${itemIndex}`).value = 'none';
    }
}

function removeItemEntry(categoryId, itemIndex) {
    const element = document.getElementById(`itemEntry${categoryId}_${itemIndex}`);
    if (element) {
        element.remove();
        updateItemNumbers(categoryId);
    }
}

function updateItemNumbers(categoryId) {
    const container = document.getElementById(`itemsContainer${categoryId}`);
    Array.from(container.children).forEach((child, index) => {
        const title = child.querySelector('h4');
        if (title) {
            title.textContent = `奖项 #${index + 1}`;
        }
    });
}

function updateItemSelection(categoryId, itemIndex) {
    const select = document.getElementById(`itemSelect${categoryId}_${itemIndex}`);
    const selectedItemInfo = document.getElementById(`selectedItemInfo${categoryId}_${itemIndex}`);
    const itemInfoText = document.getElementById(`itemInfoText${categoryId}_${itemIndex}`);
    const fileUpload = document.getElementById(`fileUpload${categoryId}_${itemIndex}`);
    
    if (select.value) {
        const category = categories.find(c => c.id === categoryId);
        const selectedItem = category.items.find(item => item.id == select.value);
        
        selectedItemInfo.style.display = 'block';
        itemInfoText.textContent = selectedItem.name;
        
        // 启用文件上传
        fileUpload.classList.add('enabled');
        
        // 更新分数计算
        updateScoreCalculation(categoryId, itemIndex);
    } else {
        selectedItemInfo.style.display = 'none';
        fileUpload.classList.remove('enabled');
    }
}

function updateScoreCalculation(categoryId, itemIndex) {
    const itemSelect = document.getElementById(`itemSelect${categoryId}_${itemIndex}`);
    const levelSelect = document.getElementById(`levelSelect${categoryId}_${itemIndex}`);
    const gradeSelect = document.getElementById(`gradeSelect${categoryId}_${itemIndex}`);
    
    if (!itemSelect.value) return;
    
    const category = categories.find(c => c.id === categoryId);
    const selectedItem = category.items.find(item => item.id == itemSelect.value);
    const selectedLevel = levelSelect.value;
    const selectedGrade = gradeSelect.value;
    
    if (selectedItem && selectedLevel && selectedGrade) {
        const scoreKey = `${selectedLevel}_${selectedGrade}`;
        const finalScore = selectedItem.scores[scoreKey] || 0;
        
        // 更新显示
        document.getElementById(`finalScore${categoryId}_${itemIndex}`).textContent = finalScore;
    }
}

// 文件上传管理
function selectFilesForItem(categoryId, itemIndex) {
    const select = document.getElementById(`itemSelect${categoryId}_${itemIndex}`);
    if (!select.value) {
        alert('请先选择具体项目！');
        return;
    }
    document.getElementById(`fileInput${categoryId}_${itemIndex}`).click();
}

async function handleItemFileSelect(categoryId, itemIndex, input) {
    const files = Array.from(input.files);
    const select = document.getElementById(`itemSelect${categoryId}_${itemIndex}`);
    
    if (!select.value) {
        alert('请先选择具体项目！');
        input.value = ''; // 清空文件选择
        return;
    }
    
    if (files.length === 0) return;
    
    // 显示上传进度
    const uploadStatus = document.createElement('div');
    uploadStatus.style.cssText = 'color: white; font-size: 12px; margin-top: 10px;';
    uploadStatus.textContent = '正在上传文件...';
    const uploadContainer = document.getElementById(`fileUpload${categoryId}_${itemIndex}`);
    if (uploadContainer) {
        uploadContainer.appendChild(uploadStatus);
    } else {
        console.error('Upload container not found:', `fileUpload${categoryId}_${itemIndex}`);
    }
    
    try {
        // 验证文件
        for (const file of files) {
            if (file.size > 50 * 1024 * 1024) { // 50MB限制
                throw new Error(`文件 ${file.name} 超过50MB大小限制`);
            }
            if (!file.type.match(/^(image\/(jpeg|png|gif)|application\/(pdf|msword)|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/)) {
                throw new Error(`文件 ${file.name} 类型不支持`);
            }
        }
        
        const uploadPromises = files.map(file => uploadFile(file));
        const uploadedFiles = await Promise.all(uploadPromises);
        
        // 保存文件信息到临时存储
        if (!window.tempFiles) window.tempFiles = {};
        const key = `${categoryId}_${itemIndex}`;
        if (!window.tempFiles[key]) window.tempFiles[key] = [];
        window.tempFiles[key].push(...uploadedFiles);
        
        renderItemFileList(categoryId, itemIndex, window.tempFiles[key]);
        uploadStatus.remove();
        input.value = ''; // 清空文件选择
        
    } catch (error) {
        console.error('File upload error:', error);
        alert('文件上传失败：' + error.message);
        if (uploadStatus && uploadStatus.parentNode) {
            uploadStatus.remove();
        }
        input.value = ''; // 清空文件选择
    }
}

async function uploadFile(file) {
    if (!file) {
        throw new Error('无效的文件对象');
    }
    
    const formData = new FormData();
    formData.append('action', 'upload');
    formData.append('files[]', file);
    
    try {
        console.log('Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type);
        
        const response = await fetch('api/upload.php', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
        }
        
        const responseText = await response.text();
        let result;
        
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON解析错误:', responseText);
            throw new Error('服务器返回非JSON格式响应');
        }
        
        if (!result.success) {
            throw new Error(result.message || '上传失败');
        }
        
        // 处理单个文件上传结果
        const fileData = result.data && result.data[0];
        if (!fileData) {
            console.error('上传结果:', result);
            throw new Error('上传返回数据格式错误');
        }
        
        console.log('文件上传成功，返回数据:', fileData);
        
        return {
            name: fileData.original_name,
            size: fileData.file_size,
            type: fileData.file_type,
            uploadTime: new Date().toLocaleString(),
            url: fileData.url || fileData.file_path,
            path: fileData.file_name || fileData.file_path
        };
    } catch (error) {
        console.error('Upload error details:', {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            error: error.message
        });
        throw new Error(`文件 ${file.name} 上传失败: ${error.message}`);
    }
}

function loadExistingFiles(categoryId, itemIndex, files) {
    if (!window.tempFiles) window.tempFiles = {};
    const key = `${categoryId}_${itemIndex}`;
    window.tempFiles[key] = files.map(file => ({
        name: file.file_name,
        size: file.file_size,
        type: file.file_type,
        uploadTime: formatDate(file.upload_time),
        url: 'uploads/' + file.file_path,
        path: file.file_path,
        id: file.id
    }));
    renderItemFileList(categoryId, itemIndex, window.tempFiles[key]);
}

function renderItemFileList(categoryId, itemIndex, files) {
    const container = document.getElementById(`fileList${categoryId}_${itemIndex}`);
    container.innerHTML = '';
    
    files.forEach((file, fileIndex) => {
        const fileEl = document.createElement('div');
        fileEl.className = 'file-item';
        fileEl.innerHTML = `
            <div style="display: flex; align-items: center; flex: 1;">
                <span class="file-name">${file.name}</span>
                <button class="btn-outline btn" onclick="previewFile('${file.url}', '${file.type}', '${file.name}')" style="margin-left: 10px; padding: 2px 8px; font-size: 12px;">预览</button>
            </div>
            <button class="file-remove" onclick="removeItemFile(${categoryId}, ${itemIndex}, ${fileIndex})">删除</button>
        `;
        container.appendChild(fileEl);
    });
}

function removeItemFile(categoryId, itemIndex, fileIndex) {
    if (!window.tempFiles) return;
    
    const key = `${categoryId}_${itemIndex}`;
    if (window.tempFiles[key]) {
        window.tempFiles[key].splice(fileIndex, 1);
        renderItemFileList(categoryId, itemIndex, window.tempFiles[key]);
    }
}

// 文件预览
function previewFile(fileUrl, fileType, fileName) {
    console.log('预览文件:', { fileUrl, fileType, fileName });
    
    if (!fileUrl || fileUrl === 'undefined') {
        alert('文件URL无效，无法预览');
        return;
    }
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        backdrop-filter: blur(10px);
    `;
    
    let content = '';
    if (fileType.startsWith('image/')) {
        content = `
            <div style="max-width: 90%; max-height: 90%; background: white; padding: 20px; border-radius: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: #333;">${fileName}</h3>
                    <button onclick="this.closest('.modal').remove()" style="background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">关闭</button>
                </div>
                <img src="${fileUrl}" style="max-width: 100%; max-height: 70vh; object-fit: contain;" />
            </div>
        `;
    } else if (fileType === 'application/pdf') {
        content = `
            <div style="max-width: 90%; max-height: 90%; background: white; padding: 20px; border-radius: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: #333;">${fileName}</h3>
                    <button onclick="this.closest('.modal').remove()" style="background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">关闭</button>
                </div>
                <iframe src="${fileUrl}" style="width: 80vw; height: 70vh; border: none;"></iframe>
            </div>
        `;
    } else {
        content = `
            <div style="max-width: 400px; background: white; padding: 20px; border-radius: 12px; text-align: center;">
                <h3 style="margin: 0 0 15px 0; color: #333;">${fileName}</h3>
                <p style="color: #666; margin-bottom: 20px;">无法预览此类型文件</p>
                <div>
                    <a href="${fileUrl}" download="${fileName}" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-right: 10px;">下载文件</a>
                    <button onclick="this.closest('.modal').remove()" style="background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">关闭</button>
                </div>
            </div>
        `;
    }
    
    modal.className = 'modal';
    modal.innerHTML = content;
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    document.body.appendChild(modal);
}

// 提交申请
async function submitApplication() {
    const batchId = parseInt(document.getElementById('currentBatchTitle').dataset.batchId);
    
    // 收集所有申请数据
    const applicationData = [];
    
    categories.forEach(category => {
        const container = document.getElementById(`itemsContainer${category.id}`);
        if (!container) return;
        
        Array.from(container.children).forEach(itemEl => {
            const itemIndex = itemEl.id.split('_')[1];
            const itemSelect = document.getElementById(`itemSelect${category.id}_${itemIndex}`);
            const levelSelect = document.getElementById(`levelSelect${category.id}_${itemIndex}`);
            const gradeSelect = document.getElementById(`gradeSelect${category.id}_${itemIndex}`);
            
            if (itemSelect && itemSelect.value && levelSelect && gradeSelect) {
                const files = window.tempFiles && window.tempFiles[`${category.id}_${itemIndex}`] || [];
                
                if (files.length > 0) {
                    // 计算分数
                    const selectedItem = category.items.find(item => item.id == itemSelect.value);
                    const scoreKey = `${levelSelect.value}_${gradeSelect.value}`;
                    let score = 0;
                    
                    if (selectedItem && selectedItem.scores && selectedItem.scores[scoreKey]) {
                        score = parseInt(selectedItem.scores[scoreKey]) || 0;
                    }
                    
                    console.log('计算分数:', {
                        categoryId: category.id,
                        itemId: itemSelect.value,
                        level: levelSelect.value,
                        grade: gradeSelect.value,
                        scoreKey: scoreKey,
                        selectedItem: selectedItem,
                        score: score
                    });
                    
                    applicationData.push({
                        category_id: category.id,
                        item_id: parseInt(itemSelect.value),
                        award_level: levelSelect.value,
                        award_grade: gradeSelect.value,
                        score: score,
                        files: files.map(file => ({ 
                            path: file.path, 
                            name: file.name, 
                            size: file.size, 
                            type: file.type,
                            original_name: file.name,
                            file_name: file.path,
                            file_path: file.path,
                            file_size: file.size,
                            file_type: file.type
                        }))
                    });
                }
            }
        });
    });
    
    if (applicationData.length === 0) {
        alert('请至少完成一个奖项的申报（选择项目并上传材料）！');
        return;
    }
    
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = '提交中...';
    
    try {
        const apiData = {
            action: currentApplication ? 'updateApplication' : 'submitApplication',
            batch_id: batchId,
            materials: applicationData
        };
        
        if (currentApplication) {
            apiData.application_id = currentApplication.id;
        }
        
        console.log('提交申请数据:', apiData);
        
        const response = await ApiClient.post('api/applications.php', apiData);
        
        console.log('申请提交响应:', response);
        
        if (response.success) {
            alert(currentApplication ? '申请更新成功！' : '申请提交成功！');
            window.tempFiles = {};
            currentApplication = null;
            showStudentPage();
        } else {
            throw new Error(response.message || '提交失败');
        }
        
    } catch (error) {
        console.error('Submit application error:', error);
        console.error('Error details:', {
            batchId: batchId,
            applicationData: applicationData,
            error: error.message
        });
        alert('提交失败：' + error.message);
        btn.disabled = false;
        btn.textContent = currentApplication ? '更新申请' : '提交申请';
    }
}

// 公告管理
function showAnnouncementModal() {
    const activeAnnouncement = announcements.find(ann => ann.is_active);
    if (!activeAnnouncement) {
        alert('暂无最新公告');
        return;
    }
    
    document.getElementById('modalAnnouncementTitle').textContent = activeAnnouncement.title;
    document.getElementById('modalAnnouncementBody').innerHTML = activeAnnouncement.content.replace(/\n/g, '<br>');
    document.getElementById('modalAnnouncementDate').textContent = '发布时间：' + formatDate(activeAnnouncement.publish_time);
    
    document.getElementById('announcementModal').classList.remove('hidden');
}

function closeAnnouncementModal() {
    document.getElementById('announcementModal').classList.add('hidden');
}

function dontRemindToday() {
    const today = new Date().toDateString();
    const remindKey = `no_remind_${today}`;
    window.tempStorage = window.tempStorage || {};
    window.tempStorage[remindKey] = true;
    closeAnnouncementModal();
    
    // 最小化公告按钮
    const announcementBtn = document.getElementById('announcementBtn');
    if (announcementBtn) {
        announcementBtn.classList.add('minimized');
    }
}

function shouldShowAnnouncementOnLogin() {
    const today = new Date().toDateString();
    const remindKey = `no_remind_${today}`;
    return !(window.tempStorage && window.tempStorage[remindKey]);
}

// 管理员公告管理
document.getElementById('announcementForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    await publishAnnouncement();
});

async function publishAnnouncement() {
    const title = document.getElementById('announcementTitle').value;
    const content = document.getElementById('announcementContent').value;
    const type = document.getElementById('announcementType').value;
    
    if (!title || !content) {
        alert('请填写完整的公告信息！');
        return;
    }
    
    try {
        const response = await ApiClient.post('api/announcements.php', {
            action: 'create',
            title: title,
            content: content,
            type: type
        });
        
        if (response.success) {
            clearAnnouncementForm();
            await DataManager.loadAnnouncements();
            renderAnnouncementHistory();
            alert('公告发布成功！');
        } else {
            throw new Error(response.message || '发布失败');
        }
    } catch (error) {
        console.error('Publish announcement error:', error);
        alert('发布公告失败：' + error.message);
    }
}

function clearAnnouncementForm() {
    document.getElementById('announcementTitle').value = '';
    document.getElementById('announcementContent').value = '';
    document.getElementById('announcementType').value = 'normal';
}

async function renderAnnouncementHistory() {
    const container = document.getElementById('announcementHistory');
    container.innerHTML = '';
    
    try {
        await DataManager.loadAnnouncements();
        
        if (announcements.length === 0) {
            container.innerHTML = '<div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 40px;">暂无公告记录</div>';
            return;
        }
        
        announcements.forEach(announcement => {
            const announcementEl = document.createElement('div');
            announcementEl.className = 'category-item';
            announcementEl.style.marginBottom = '15px';
            
            const typeColors = {
                'normal': '#6b7280',
                'important': '#f59e0b', 
                'urgent': '#ef4444'
            };
            
            const typeNames = {
                'normal': '普通',
                'important': '重要',
                'urgent': '紧急'
            };
            
            announcementEl.innerHTML = `
                <div>
                    <div style="color: white; font-weight: 500; margin-bottom: 5px;">
                        ${announcement.title}
                        ${announcement.is_active ? '<span style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 8px;">当前</span>' : ''}
                    </div>
                    <div style="color: rgba(255, 255, 255, 0.7); font-size: 12px; margin-bottom: 8px;">
                        <span style="color: ${typeColors[announcement.type]}; font-weight: 500;">[${typeNames[announcement.type]}]</span>
                        ${formatDate(announcement.publish_time)}
                    </div>
                    <div style="color: rgba(255, 255, 255, 0.6); font-size: 12px; max-height: 60px; overflow: hidden;">
                        ${announcement.content.length > 100 ? announcement.content.substring(0, 100) + '...' : announcement.content}
                    </div>
                </div>
                <div style="display: flex; gap: 10px;">
                    ${!announcement.is_active ? 
                        `<button class="btn-success btn" onclick="setActiveAnnouncement(${announcement.id})" style="padding: 6px 12px; font-size: 12px;">设为当前</button>` : 
                        ''
                    }
                    <button class="btn-outline btn" onclick="viewAnnouncementDetail(${announcement.id})" style="padding: 6px 12px; font-size: 12px;">查看</button>
                    <button class="btn-danger btn" onclick="deleteAnnouncement(${announcement.id})" style="padding: 6px 12px; font-size: 12px;">删除</button>
                </div>
            `;
            
            container.appendChild(announcementEl);
        });
        
    } catch (error) {
        console.error('Error rendering announcement history:', error);
        container.innerHTML = '<div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 40px;">加载公告失败</div>';
    }
}

async function setActiveAnnouncement(id) {
    try {
        const response = await ApiClient.post('api/announcements.php', {
            action: 'setActive',
            id: id
        });
        
        if (response.success) {
            await DataManager.loadAnnouncements();
            renderAnnouncementHistory();
            alert('已设置为当前公告！');
        } else {
            throw new Error(response.message || '设置失败');
        }
    } catch (error) {
        console.error('Set active announcement error:', error);
        alert('设置公告失败：' + error.message);
    }
}

function viewAnnouncementDetail(id) {
    const announcement = announcements.find(ann => ann.id === id);
    if (announcement) {
        alert(`标题：${announcement.title}\n\n内容：\n${announcement.content}\n\n发布时间：${formatDate(announcement.publish_time)}`);
    }
}

async function deleteAnnouncement(id) {
    if (!confirm('确定要删除这条公告吗？')) return;
    
    try {
        const response = await ApiClient.post('api/announcements.php', {
            action: 'delete',
            id: id
        });
        
        if (response.success) {
            await DataManager.loadAnnouncements();
            renderAnnouncementHistory();
            alert('公告已删除！');
        } else {
            throw new Error(response.message || '删除失败');
        }
    } catch (error) {
        console.error('Delete announcement error:', error);
        alert('删除公告失败：' + error.message);
    }
}

// 管理员功能
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    if (tabName === 'materials') {
        renderStudentMaterials();
    } else if (tabName === 'itemManagement') {
        renderItemsList();
    } else if (tabName === 'announcements') {
        renderAnnouncementHistory();
    } else if (tabName === 'overview') {
        updateStats();
    } else if (tabName === 'userManagement') {
        loadUsersList();
    }
}

async function updateStats() {
    try {
        const response = await ApiClient.get('api/applications.php?action=getStats');
        if (response.success) {
            document.getElementById('totalApplications').textContent = response.stats.total_applications || 0;
            document.getElementById('totalCategories').textContent = categories.length;
        }
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// 类目管理
function updateCategorySelect() {
    const select = document.getElementById('categorySelectForItem');
    select.innerHTML = '<option value="">请选择类别</option>';
    categories.forEach(category => {
        select.innerHTML += `<option value="${category.id}">${category.name}</option>`;
    });
}

async function addCategory() {
    const name = document.getElementById('categoryName').value;
    const score = parseInt(document.getElementById('categoryScore').value);
    
    if (!name || !score) {
        alert('请填写完整信息！');
        return;
    }
    
    try {
        const response = await ApiClient.post('api/categories.php', {
            action: 'createCategory',
            name: name,
            score: score
        });
        
        if (response.success) {
            document.getElementById('categoryName').value = '';
            document.getElementById('categoryScore').value = '';
            
            await DataManager.loadCategories();
            updateCategorySelect();
            renderCategoryList();
            updateStats();
            alert('类目添加成功！');
        } else {
            throw new Error(response.message || '添加失败');
        }
    } catch (error) {
        console.error('Add category error:', error);
        alert('添加类目失败：' + error.message);
    }
}

async function removeCategory(id) {
    if (!confirm('确定要删除这个类目吗？这将同时删除该类目下的所有奖项！')) return;
    
    try {
        const response = await ApiClient.post('api/categories.php', {
            action: 'deleteCategory',
            id: id
        });
        
        if (response.success) {
            await DataManager.loadCategories();
            updateCategorySelect();
            renderCategoryList();
            updateStats();
            alert('类目删除成功！');
        } else {
            throw new Error(response.message || '删除失败');
        }
    } catch (error) {
        console.error('Remove category error:', error);
        alert('删除类目失败：' + error.message);
    }
}

function renderCategoryList() {
    const container = document.getElementById('categoryList');
    container.innerHTML = '';
    
    categories.forEach(category => {
        const categoryEl = document.createElement('div');
        categoryEl.className = 'category-item';
        categoryEl.innerHTML = `
            <div>
                <div style="color: white; font-weight: 500;">${category.name}</div>
                <div style="color: rgba(255, 255, 255, 0.7); font-size: 12px;">分数: ${category.score}</div>
            </div>
            <button class="btn-outline btn" onclick="removeCategory(${category.id})">删除</button>
        `;
        container.appendChild(categoryEl);
    });
}

// 奖项管理
async function addNewItemToCategory() {
    const categoryId = parseInt(document.getElementById('categorySelectForItem').value);
    const itemName = document.getElementById('newItemName').value;
    
    if (!categoryId || !itemName) {
        alert('请填写完整信息！');
        return;
    }
    
    try {
        const response = await ApiClient.post('api/categories.php', {
            action: 'createItem',
            category_id: categoryId,
            name: itemName
        });
        
        if (response.success) {
            document.getElementById('categorySelectForItem').value = '';
            document.getElementById('newItemName').value = '';
            
            await DataManager.loadCategories();
            renderItemsList();
            alert('奖项添加成功！请设置各级别等级的分数。');
        } else {
            throw new Error(response.message || '添加失败');
        }
    } catch (error) {
        console.error('Add item error:', error);
        alert('添加奖项失败：' + error.message);
    }
}

async function removeItemFromCategory(categoryId, itemId) {
    if (!confirm('确定要删除这个奖项吗？')) return;
    
    try {
        const response = await ApiClient.post('api/categories.php', {
            action: 'deleteItem',
            id: itemId
        });
        
        if (response.success) {
            await DataManager.loadCategories();
            renderItemsList();
            alert('奖项删除成功！');
        } else {
            throw new Error(response.message || '删除失败');
        }
    } catch (error) {
        console.error('Remove item error:', error);
        alert('删除奖项失败：' + error.message);
    }
}

async function updateItemScore(categoryId, itemId, level, grade, score) {
    try {
        await ApiClient.post('api/categories.php', {
            action: 'updateScore',
            item_id: itemId,
            level: level,
            grade: grade,
            score: parseInt(score) || 0
        });
    } catch (error) {
        console.error('Update score error:', error);
    }
}

function renderItemsList() {
    const container = document.getElementById('itemsListContainer');
    container.innerHTML = '';
    
    categories.forEach(category => {
        const categorySection = document.createElement('div');
        categorySection.style.cssText = `
            background: rgba(255, 255, 255, 0.05);
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        `;
        
        let itemsHtml = '';
        category.items.forEach(item => {
            // 创建分数配置表格
            let scoreTableHtml = `
                <table class="score-table">
                    <thead>
                        <tr>
                            <th>级别/等级</th>
                            <th>一等奖</th>
                            <th>二等奖</th>
                            <th>三等奖</th>
                            <th>无等级</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            awardLevels.forEach(level => {
                scoreTableHtml += `<tr>
                    <td style="color: white; font-weight: 500;">${levelNames[level]}</td>`;
                awardGrades.forEach(grade => {
                    const scoreKey = `${level}_${grade}`;
                    const score = item.scores[scoreKey] || 0;
                    scoreTableHtml += `
                        <td>
                            <input type="number" value="${score}" min="0" max="100" 
                                   onchange="updateItemScore(${category.id}, ${item.id}, '${level}', '${grade}', this.value)">
                        </td>`;
                });
                scoreTableHtml += '</tr>';
            });
            
            scoreTableHtml += '</tbody></table>';
            
            itemsHtml += `
                <div style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <div style="color: white; font-weight: 500; font-size: 16px;">${item.name}</div>
                        <button class="btn-outline btn" onclick="removeItemFromCategory(${category.id}, ${item.id})">删除</button>
                    </div>
                    ${scoreTableHtml}
                </div>
            `;
        });
        
        categorySection.innerHTML = `
            <h3 style="color: white; margin-bottom: 15px; display: flex; align-items: center;">
                <span style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 8px 12px; border-radius: 8px; font-size: 14px; margin-right: 15px;">${category.name}</span>
                共 ${category.items.length} 个奖项
            </h3>
            ${itemsHtml}
        `;
        
        container.appendChild(categorySection);
    });
}

// 材料审核
async function renderStudentMaterials() {
    const container = document.getElementById('studentMaterials');
    container.innerHTML = '';
    
    try {
        const response = await ApiClient.get('api/applications.php?action=getAllApplications');
        
        if (response.success && response.applications.length > 0) {
            response.applications.forEach(application => {
                const studentCard = document.createElement('div');
                studentCard.className = 'student-card';
                
                let materialsHtml = '';
                let totalScore = 0;
                
                if (application.materials && application.materials.length > 0) {
                    const materialsByCategory = {};
                    application.materials.forEach(material => {
                        if (!materialsByCategory[material.category_name]) {
                            materialsByCategory[material.category_name] = [];
                        }
                        materialsByCategory[material.category_name].push(material);
                        totalScore += material.score;
                    });
                    
                    Object.keys(materialsByCategory).forEach(categoryName => {
                        const categoryItems = materialsByCategory[categoryName];
                        const categoryScore = categoryItems.reduce((sum, item) => sum + item.score, 0);
                        
                        let categoryItemsHtml = '';
                        categoryItems.forEach((material, index) => {
                            const filesHtml = material.files ? material.files.map(file => `
                                <div class="material-item" style="margin: 5px;">
                                    <div class="material-preview" onclick="previewFile('uploads/${file.file_path}', '${file.file_type}', '${file.file_name}')" style="cursor: pointer;">📄</div>
                                    <div style="color: white; font-size: 12px; text-align: center; margin-top: 5px;">${file.file_name}</div>
                                    <div style="color: rgba(255, 255, 255, 0.5); font-size: 10px; text-align: center;">${formatDate(file.upload_time)}</div>
                                </div>
                            `).join('') : '';
                            
                            const levelName = levelNames[material.award_level] || '未知级别';
                            const gradeName = gradeNames[material.award_grade] || '未知等级';
                            
                            categoryItemsHtml += `
                                <div style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                                    <div style="color: #fbbf24; font-weight: 500; margin-bottom: 5px;">
                                        ${index + 1}. ${material.item_name}
                                    </div>
                                    <div style="color: rgba(255, 255, 255, 0.8); font-size: 13px; margin-bottom: 10px;">
                                        ${levelName} ${gradeName} - 得分: <span style="color: #22c55e; font-weight: bold;">${material.score}分</span>
                                    </div>
                                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                                        ${filesHtml}
                                    </div>
                                </div>
                            `;
                        });
                        
                        materialsHtml += `
                            <div style="margin-bottom: 25px;">
                                <h4 style="color: white; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                                    <span>${categoryName}</span>
                                    <span style="color: #22c55e; font-size: 14px; background: rgba(34, 197, 94, 0.2); padding: 4px 8px; border-radius: 6px;">
                                        ${categoryScore}分
                                    </span>
                                </h4>
                                ${categoryItemsHtml}
                            </div>
                        `;
                    });
                }
                
                const statusText = {
                    'pending': '待审核',
                    'approved': '已通过',
                    'rejected': '已驳回'
                };
                
                const statusClass = `status-${application.status}`;
                
                studentCard.innerHTML = `
                    <div class="student-header">
                        <div>
                            <div style="color: white; font-weight: 600;">学生用户 (ID: ${application.user_id})</div>
                            <div style="color: rgba(255, 255, 255, 0.7); font-size: 12px;">
                                批次: ${application.batch_name}<br>
                                提交时间: ${formatDate(application.submit_time)}<br>
                                总分: <span style="color: #22c55e; font-weight: bold;">${totalScore}分</span>
                            </div>
                            <span class="application-status ${statusClass}" style="margin-top: 10px; display: inline-block;">
                                ${statusText[application.status]}
                            </span>
                        </div>
                        <div class="action-buttons">
                            <button class="btn-success btn" onclick="reviewApplication(${application.id}, 'approved')">通过</button>
                            <button class="btn-danger btn" onclick="reviewApplication(${application.id}, 'rejected')">驳回</button>
                            <button class="btn-warning btn" onclick="requestModification(${application.id})">要求修改</button>
                        </div>
                    </div>
                    ${application.review_comment ? `
                        <div style="background: rgba(255, 255, 255, 0.1); padding: 10px; border-radius: 8px; margin: 15px 0;">
                            <div style="color: white; font-size: 12px; font-weight: 500;">审核意见:</div>
                            <div style="color: rgba(255, 255, 255, 0.8); font-size: 14px; margin-top: 5px;">${application.review_comment}</div>
                        </div>
                    ` : ''}
                    ${materialsHtml || '<div style="color: rgba(255, 255, 255, 0.7); padding: 20px; text-align: center;">暂无申报项目</div>'}
                `;
                
                container.appendChild(studentCard);
            });
        } else {
            container.innerHTML = '<div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 40px;">暂无学生申请</div>';
        }
        
    } catch (error) {
        console.error('Error rendering student materials:', error);
        container.innerHTML = '<div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 40px;">加载申请失败</div>';
    }
}

async function reviewApplication(applicationId, status) {
    const comment = prompt(status === 'approved' ? '请输入通过理由（可选）:' : '请输入驳回理由:');
    
    if (status === 'rejected' && (!comment || comment.trim() === '')) {
        alert('驳回申请必须填写理由！');
        return;
    }
    
    try {
        const response = await ApiClient.post('api/applications.php', {
            action: 'reviewApplication',
            application_id: applicationId,
            status: status,
            comment: comment || ''
        });
        
        if (response.success) {
            alert(`申请已${status === 'approved' ? '通过' : '驳回'}！`);
            renderStudentMaterials();
        } else {
            throw new Error(response.message || '审核失败');
        }
    } catch (error) {
        console.error('Review application error:', error);
        alert('审核失败：' + error.message);
    }
}

async function requestModification(applicationId) {
    const comment = prompt('请输入修改要求:');
    
    if (!comment || comment.trim() === '') {
        alert('请填写修改要求！');
        return;
    }
    
    try {
        const response = await ApiClient.post('api/applications.php', {
            action: 'reviewApplication',
            application_id: applicationId,
            status: 'rejected',
            comment: '要求修改: ' + comment
        });
        
        if (response.success) {
            alert('修改要求已发送给学生！');
            renderStudentMaterials();
        } else {
            throw new Error(response.message || '操作失败');
        }
    } catch (error) {
        console.error('Request modification error:', error);
        alert('操作失败：' + error.message);
    }
}

// 用户管理相关函数
let currentEditingUser = null;

// 加载用户列表
async function loadUsersList() {
    try {
        const response = await ApiClient.get('api/users.php?action=list');
        if (response.success) {
            renderUsersList(response.users);
        } else {
            throw new Error(response.message || '加载用户列表失败');
        }
    } catch (error) {
        console.error('Load users error:', error);
        document.getElementById('usersList').innerHTML = '<div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 40px;">加载用户列表失败</div>';
    }
}

// 渲染用户列表
function renderUsersList(users) {
    const container = document.getElementById('usersList');
    
    if (!users || users.length === 0) {
        container.innerHTML = '<div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 40px;">暂无用户</div>';
        return;
    }
    
    let usersHtml = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
    `;
    
    users.forEach(user => {
        const userTypeText = user.type === 'admin' ? '管理员' : '学生';
        const userTypeClass = user.type === 'admin' ? 'admin-user' : 'student-user';
        
        usersHtml += `
            <div class="user-card" style="background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.2);">
                <div style="display: flex; justify-content: between; align-items: flex-start; margin-bottom: 15px;">
                    <div>
                        <div style="color: white; font-weight: 600; font-size: 16px; margin-bottom: 5px;">
                            ${user.real_name || user.username}
                        </div>
                        <div style="color: rgba(255, 255, 255, 0.7); font-size: 14px; margin-bottom: 5px;">
                            用户名: ${user.username}
                        </div>
                        <span class="user-type ${userTypeClass}" style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; ${user.type === 'admin' ? 'background: rgba(239, 68, 68, 0.2); color: #fca5a5;' : 'background: rgba(34, 197, 94, 0.2); color: #86efac;'}">
                            ${userTypeText}
                        </span>
                    </div>
                </div>
                
                ${user.email || user.phone ? `
                    <div style="margin-bottom: 15px;">
                        ${user.email ? `<div style="color: rgba(255, 255, 255, 0.8); font-size: 13px; margin-bottom: 3px;">📧 ${user.email}</div>` : ''}
                        ${user.phone ? `<div style="color: rgba(255, 255, 255, 0.8); font-size: 13px; margin-bottom: 3px;">📱 ${user.phone}</div>` : ''}
                    </div>
                ` : ''}
                
                ${user.type === 'student' && (user.student_id || user.class || user.major) ? `
                    <div style="margin-bottom: 15px; padding: 10px; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
                        <div style="color: rgba(255, 255, 255, 0.7); font-size: 12px; margin-bottom: 5px;">学生信息</div>
                        ${user.student_id ? `<div style="color: rgba(255, 255, 255, 0.8); font-size: 13px;">学号: ${user.student_id}</div>` : ''}
                        ${user.class ? `<div style="color: rgba(255, 255, 255, 0.8); font-size: 13px;">班级: ${user.class}</div>` : ''}
                        ${user.major ? `<div style="color: rgba(255, 255, 255, 0.8); font-size: 13px;">专业: ${user.major}</div>` : ''}
                    </div>
                ` : ''}
                
                <div style="color: rgba(255, 255, 255, 0.6); font-size: 12px; margin-bottom: 15px;">
                    创建时间：${formatDate(user.created_at)}
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="btn-outline btn" onclick="editUser(${user.id})" style="padding: 6px 12px; font-size: 12px;">编辑</button>
                    <button class="btn-danger btn" onclick="deleteUser(${user.id}, '${user.username}')" style="padding: 6px 12px; font-size: 12px;">删除</button>
                </div>
            </div>
        `;
    });
    
    usersHtml += '</div>';
    container.innerHTML = usersHtml;
}

// 添加用户
async function addUser() {
    const formData = new FormData();
    formData.append('action', currentEditingUser ? 'update' : 'add');
    formData.append('username', document.getElementById('newUsername').value);
    formData.append('type', document.getElementById('userType').value);
    formData.append('real_name', document.getElementById('realName').value);
    formData.append('email', document.getElementById('userEmail').value);
    formData.append('phone', document.getElementById('userPhone').value);
    
    const password = document.getElementById('newPassword').value;
    if (password || !currentEditingUser) {
        formData.append('password', password);
    }
    
    if (currentEditingUser) {
        formData.append('id', currentEditingUser);
    }
    
    // 如果是学生，添加学生信息
    if (document.getElementById('userType').value === 'student') {
        formData.append('student_id', document.getElementById('studentId').value);
        formData.append('class', document.getElementById('userClass').value);
        formData.append('major', document.getElementById('userMajor').value);
    }
    
    try {
        const response = await fetch('api/users.php', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(currentEditingUser ? '用户更新成功！' : '用户添加成功！');
            if (currentEditingUser) {
                currentEditingUser = null;
                document.querySelector('#userForm button[type="submit"]').textContent = '添加用户';
            }
            clearUserForm();
            loadUsersList();
        } else {
            throw new Error(data.message || '操作失败');
        }
    } catch (error) {
        console.error('Add/Update user error:', error);
        alert('操作失败：' + error.message);
    }
}

// 编辑用户
async function editUser(userId) {
    try {
        const response = await ApiClient.get('api/users.php?action=list');
        if (response.success) {
            const user = response.users.find(u => u.id == userId);
            if (user) {
                // 填充编辑表单
                document.getElementById('editUserId').value = user.id;
                document.getElementById('editUsername').value = user.username;
                document.getElementById('editPassword').value = ''; // 不显示原密码
                document.getElementById('editUserType').value = user.type;
                document.getElementById('editRealName').value = user.real_name || '';
                document.getElementById('editUserEmail').value = user.email || '';
                document.getElementById('editUserPhone').value = user.phone || '';
                document.getElementById('editStudentId').value = user.student_id || '';
                document.getElementById('editUserClass').value = user.class || '';
                document.getElementById('editUserMajor').value = user.major || '';
                
                // 显示/隐藏学生字段
                const studentFields = document.getElementById('editStudentFields');
                if (user.type === 'student') {
                    studentFields.style.display = 'flex';
                } else {
                    studentFields.style.display = 'none';
                }
                
                // 显示编辑弹窗
                document.getElementById('editUserModal').classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error('Edit user error:', error);
        alert('获取用户信息失败：' + error.message);
    }
}

// 关闭编辑用户弹窗
function closeEditUserModal() {
    document.getElementById('editUserModal').classList.add('hidden');
}

// 保存用户编辑
async function saveUserEdit() {
    const formData = new FormData();
    formData.append('action', 'update');
    formData.append('id', document.getElementById('editUserId').value);
    formData.append('username', document.getElementById('editUsername').value);
    formData.append('type', document.getElementById('editUserType').value);
    formData.append('real_name', document.getElementById('editRealName').value);
    formData.append('email', document.getElementById('editUserEmail').value);
    formData.append('phone', document.getElementById('editUserPhone').value);
    
    const password = document.getElementById('editPassword').value;
    if (password) {
        formData.append('password', password);
    }
    
    // 如果是学生，添加学生信息
    if (document.getElementById('editUserType').value === 'student') {
        formData.append('student_id', document.getElementById('editStudentId').value);
        formData.append('class', document.getElementById('editUserClass').value);
        formData.append('major', document.getElementById('editUserMajor').value);
    }
    
    try {
        const response = await fetch('api/users.php', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('用户更新成功！');
            closeEditUserModal();
            loadUsersList();
        } else {
            throw new Error(data.message || '更新失败');
        }
    } catch (error) {
        console.error('Update user error:', error);
        alert('更新失败：' + error.message);
    }
}

// 删除用户
async function deleteUser(userId, username) {
    if (!confirm(`确定要删除用户 "${username}" 吗？此操作不可撤销！`)) {
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('action', 'delete');
        formData.append('id', userId);
        
        const response = await fetch('api/users.php', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('用户删除成功！');
            loadUsersList();
        } else {
            throw new Error(data.message || '删除失败');
        }
    } catch (error) {
        console.error('Delete user error:', error);
        alert('删除失败：' + error.message);
    }
}

// 清空用户表单
function clearUserForm() {
    document.getElementById('userForm').reset();
    document.getElementById('studentFields').style.display = 'none';
    document.querySelector('#userForm button[type="submit"]').textContent = '添加用户';
    currentEditingUser = null;
} 