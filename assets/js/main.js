// 奖学金评定系统 - 主要JavaScript文件
// 连接前端界面到后端API

// 全局变量
let currentUser = null;
let currentApplication = null;
let categories = [];
let batches = [];
let announcements = [];

// 强制重置提交按钮状态的函数
function forceResetSubmitButton() {
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = false;
        
        // 判断是否为编辑模式
        const isEditMode = currentApplication && currentApplication.id;
        submitBtn.textContent = isEditMode ? '更新申请' : '提交申请';
        
        submitBtn.style.opacity = '1';
        submitBtn.style.pointerEvents = 'auto';
        console.log('强制重置提交按钮状态:', submitBtn.textContent, '编辑模式:', isEditMode);
    }
}

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
            if (data.success && data.categories) {
                categories = data.categories;
                console.log('Categories loaded:', categories);
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
                
                // 检查是否需要强制修改密码
                if (!checkForcePasswordChange(user)) {
                    // 如果不需要强制修改密码，则正常显示公告
                    if (shouldShowAnnouncementOnLogin()) {
                        setTimeout(() => {
                            const activeAnnouncement = announcements.find(ann => ann.is_active);
                            if (activeAnnouncement) {
                                showAnnouncementModal();
                            }
                        }, 1000);
                    }
                }
            } else {
                showAdminPage();
            }
        }, 1000);
        
    } catch (error) {
        alert(error.message || '登录失败');
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
    
    // 确保所有数据都已加载
    const loadData = async () => {
        try {
            await Promise.all([
                DataManager.loadCategories(),
                DataManager.loadBatches(),
                DataManager.loadAnnouncements()
            ]);
            
            // 数据加载完成后再渲染页面
            renderBatchList();
            renderMyApplications();
            
            // 显示公告
            if (shouldShowAnnouncementOnLogin()) {
                const activeAnnouncement = announcements.find(ann => ann.is_active);
                if (activeAnnouncement) {
                    setTimeout(() => showAnnouncementModal(), 500);
                }
            }
            
            console.log('Student page data loaded successfully');
        } catch (error) {
            console.error('Failed to load student page data:', error);
            alert('加载学生页面数据失败，请刷新页面重试');
        }
    };
    
    loadData();
}

function showAdminPage() {
    hideAllPages();
    document.getElementById('adminPage').classList.add('active');
    
    // 确保所有数据都已加载
    const loadData = async () => {
        try {
            await Promise.all([
                DataManager.loadCategories(),
                DataManager.loadBatches(),
                DataManager.loadAnnouncements()
            ]);
            
            // 数据加载完成后再渲染页面
            switchTab('overview');
            updateStats();
            renderAnnouncementHistory();
            updateCategorySelect();
            renderCategoryList();
            renderItemsList();
            renderStudentMaterials();
            loadUsersList();
            // 初始化排名功能
            initRankingTab();
            
            console.log('Admin page data loaded successfully');
        } catch (error) {
            console.error('Failed to load admin page data:', error);
            alert('加载管理页面数据失败，请刷新页面重试');
        }
    };
    
    loadData();
}

function showApplicationPage(batchId, applicationId = null) {
    hideAllPages();
    document.getElementById('applicationPage').classList.add('active');
    
    // 初始化临时文件状态
    if (!window.tempFiles) {
        window.tempFiles = {};
    }
    
    // 只在非编辑模式下清除临时文件状态
    if (!applicationId) {
        window.tempFiles = {};
    }
    
    // 更新批次标题和ID
    const batch = batches.find(b => b.id == batchId);
    const titleElement = document.getElementById('currentBatchTitle');
    if (batch && titleElement) {
        titleElement.textContent = batch.name;
        titleElement.dataset.batchId = batchId; // 设置dataset.batchId
    }
    
    // 设置当前申请ID（编辑模式）
    currentApplication = applicationId ? { id: applicationId } : null;
    
    // 立即强制重置提交按钮状态
    forceResetSubmitButton();
    
    // 加载类目并渲染
    const loadAndRender = async () => {
        try {
            // 确保类目数据已加载
            if (!categories || categories.length === 0) {
                await DataManager.loadCategories();
            }
            
            // 渲染类目界面
            renderCategories(batchId);
            
            // 如果是编辑模式，加载现有申请数据
            if (applicationId) {
                await loadApplicationForEdit(applicationId);
            }
            
            // 最终确保提交按钮状态正确
            forceResetSubmitButton();
            
        } catch (error) {
            console.error('Error loading application page:', error);
            alert('加载页面失败' + error.message);
        }
    };
    
    loadAndRender();
    
    // 设置一个短暂的延迟，确保DOM完全加载后再次重置按钮
    setTimeout(() => {
        forceResetSubmitButton();
    }, 500);
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
                // 检查是否需要强制修改密码
                checkForcePasswordChange(user);
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

    // 用户管理相关事件监听
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
    
    // 监听页面可见性变化，确保按钮状态正确
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && document.getElementById('applicationPage').classList.contains('active')) {
            setTimeout(() => {
                forceResetSubmitButton();
            }, 100);
        }
    });
    
    // 监听窗口焦点事件
    window.addEventListener('focus', function() {
        if (document.getElementById('applicationPage').classList.contains('active')) {
            setTimeout(() => {
                forceResetSubmitButton();
            }, 100);
        }
    });
});

// 批次和申请管理
async function renderBatchList() {
    const container = document.getElementById('batchList');
    container.innerHTML = '';
    
    try {
        await DataManager.loadBatches();
        
        // 批量检查申请状态
        const batchApplicationStatus = {};
        await Promise.all(batches.map(async (batch) => {
            try {
                const response = await ApiClient.get(`api/applications.php?action=check_application_status&batch_id=${batch.id}`);
                if (response.success) {
                    batchApplicationStatus[batch.id] = response;
                }
            } catch (error) {
                console.error('Error checking application status for batch:', batch.id, error);
                batchApplicationStatus[batch.id] = { has_applied: false };
            }
        }));
        
        batches.forEach(batch => {
            const batchEl = document.createElement('div');
            batchEl.className = 'batch-item';
            
            const applicationStatus = batchApplicationStatus[batch.id] || { has_applied: false };
            const hasApplied = applicationStatus.has_applied;
            
            if (hasApplied) {
                batchEl.onclick = () => {
                    alert('您已在此批次提交过申请，每个批次只能提交一次申请。');
                };
            } else {
                batchEl.onclick = () => {
                    showApplicationPage(batch.id);
                };
            }
            
            let statusText, statusClass;
            if (hasApplied) {
                statusText = '已提交';
                statusClass = 'status-submitted';
            } else if (batch.status === 'open') {
                statusText = '申报中';
                statusClass = 'status-open';
            } else {
                statusText = '已截止';
                statusClass = 'status-closed';
            }
            
            batchEl.innerHTML = `
                <div class="batch-title">${batch.name}</div>
                <div class="batch-info">截止日期: ${formatDate(batch.end_date)}</div>
                <div>
                    <span class="batch-status ${statusClass}">${statusText}</span>
                </div>
            `;
            
            if (batch.status === 'closed' && !hasApplied) {
                batchEl.style.opacity = '0.6';
                batchEl.style.cursor = 'default';
                batchEl.onclick = null;
            } else if (hasApplied) {
                batchEl.style.opacity = '0.8';
                batchEl.style.cursor = 'default';
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
    container.innerHTML = '<div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 20px;">加载中..</div>';
    
    try {
        const response = await ApiClient.get('api/applications.php?action=get_user_applications');
        
        if (response.success && response.applications && response.applications.length > 0) {
            container.innerHTML = '';
            response.applications.forEach(application => {
                const statusText = {
                    'pending': '待审核',
                    'approved': '已通过', 
                    'rejected': '已驳回'
                };
                
                const statusClass = `status-${application.status}`;
                const canEdit = application.status === 'rejected' || application.status === 'pending';
                
                const applicationCard = document.createElement('div');
                applicationCard.className = 'application-card';
                applicationCard.innerHTML = `
                    <div class="application-header">
                        <div>
                            <div style="color: white; font-weight: 600;">${application.batch_name}</div>
                            <div style="color: rgba(255, 255, 255, 0.7); font-size: 12px;">
                                提交时间: ${formatDate(application.submitted_at)}<br>
                                总分: <span style="color: #22c55e; font-weight: bold;">${application.total_score || 0}分</span>
                            </div>
                            <span class="application-status ${statusClass}" style="margin-top: 10px; display: inline-block;">
                                ${statusText[application.status]}
                            </span>
                        </div>
                        <div class="action-buttons">
                            <button class="btn btn-outline" onclick="viewApplication(${application.id})">查看详情</button>
                            ${canEdit ? `<button class="btn" onclick="editApplication(${application.id})">编辑申请</button>` : ''}
                        </div>
                    </div>
                    ${application.review_comment ? `
                        <div style="background: rgba(255, 255, 255, 0.1); padding: 10px; border-radius: 8px; margin-top: 15px;">
                            <div style="color: white; font-size: 12px; font-weight: 500;">审核意见:</div>
                            <div style="color: rgba(255, 255, 255, 0.8); font-size: 14px; margin-top: 5px;">${application.review_comment}</div>
                        </div>
                    ` : ''}
                `;
                
                container.appendChild(applicationCard);
            });
        } else {
            container.innerHTML = '<div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 40px;">暂无申请记录</div>';
        }
        
    } catch (error) {
        console.error('Error rendering my applications:', error);
        container.innerHTML = '<div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 40px;">加载申请失败: ' + error.message + '</div>';
    }
}

async function loadApplicationForEdit(applicationId) {
    try {
        console.log('Loading application for edit:', applicationId);
        const response = await ApiClient.get(`api/applications.php?action=get_detail&id=${applicationId}`);
        
        if (response.success && response.data) {
            currentApplication = response.data;
            
            console.log('Loaded application data:', currentApplication);
            
            if (currentApplication.status === 'approved') {
                alert('已通过的申请不能修改！');
                showStudentPage();
                return;
            }
            
            // 如果是驳回状态，提示用户编辑规则
            if (currentApplication.status === 'rejected') {
                const proceedEdit = confirm('您的申请已被驳回，可以修改后重新提交。\n\n编辑提示：\n• 已上传的文件会保留，无需重新上传\n• 您可以删除不需要的文件或添加新文件\n• 修改完成后点击"更新申请"重新提交\n\n是否继续编辑？');
                if (!proceedEdit) {
                    showStudentPage();
                    return;
                }
            }
            
            // 预填材料数据到界面
            await preloadApplicationData();
            
        } else {
            throw new Error(response.message || '获取申请详情失败');
        }
    } catch (error) {
        console.error('Error loading application for edit:', error);
        alert('加载申请失败：' + error.message);
        showStudentPage();
    }
}

// 预加载申请数据到编辑界面
async function preloadApplicationData() {
    if (!currentApplication || !currentApplication.materials) {
        console.log('No application data to preload');
        return;
    }
    
    console.log('Preloading application materials:', currentApplication.materials);
    
    // 等待类目数据加载完成
    if (!categories || categories.length === 0) {
        await DataManager.loadCategories();
    }
    
    // 等待DOM渲染完成
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 预填每个材料数据
    currentApplication.materials.forEach((material, index) => {
        const itemIndex = `edit_${material.id}_${index}`;
        console.log('Preloading material:', material, 'with index:', itemIndex);
        console.log('Material files:', material.files);
        
        // 确保文件数据存在且格式正确
        if (material.files && Array.isArray(material.files) && material.files.length > 0) {
            console.log(`Material ${material.id} has ${material.files.length} files:`, material.files);
        } else {
            console.log(`Material ${material.id} has no files or files data is missing`);
        }
        
        addItemToCategory(material.category_id, material, itemIndex);
        
        // 验证文件是否正确加载到tempFiles
        setTimeout(() => {
            const key = `${material.category_id}_${itemIndex}`;
            if (window.tempFiles && window.tempFiles[key]) {
                console.log(`✅ Files loaded to tempFiles[${key}]:`, window.tempFiles[key]);
            } else {
                console.log(`❌ No files found in tempFiles[${key}]`);
                console.log('Current tempFiles:', window.tempFiles);
            }
        }, 200);
    });
}

async function viewApplication(applicationId) {
    try {
        const response = await ApiClient.get(`api/applications.php?action=get_detail&id=${applicationId}`);
        
        if (response.success && response.data) {
            const application = response.data;
            
            let materialsHtml = '';
            
            if (application.materials && application.materials.length > 0) {
                const materialsByCategory = {};
                application.materials.forEach(material => {
                    if (!materialsByCategory[material.category_name]) {
                        materialsByCategory[material.category_name] = [];
                    }
                    materialsByCategory[material.category_name].push(material);
                });
                
                Object.keys(materialsByCategory).forEach(categoryName => {
                    const categoryItems = materialsByCategory[categoryName];
                    const categoryScore = categoryItems.reduce((sum, item) => sum + parseFloat(item.score || 0), 0);
                    
                    let categoryItemsHtml = '';
                    categoryItems.forEach((material, index) => {
                        const filesHtml = material.files && material.files.length > 0 ? material.files.map(file => {
                            const filePath = file.file_path.startsWith('uploads/') ? file.file_path : `uploads/${file.file_path}`;
                            const fileIcon = getFileIcon(file.file_type || file.original_name);
                            return `
                                <div style="margin: 5px; padding: 10px; background: rgba(255,255,255,0.15); border-radius: 8px; display: inline-block; min-width: 120px; border: 1px solid rgba(255,255,255,0.1); transition: all 0.3s ease; cursor: pointer;" onclick="previewFile('${filePath}', '${file.file_type}', '${file.original_name}')" onmouseover="this.style.background='rgba(255,255,255,0.25)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">
                                    <div style="color: white; font-size: 13px; margin-bottom: 4px; word-break: break-all;">
                                        ${fileIcon} ${file.original_name}
                                    </div>
                                    <div style="color: rgba(255, 255, 255, 0.6); font-size: 11px;">${formatFileSize(file.file_size)}</div>
                                </div>
                            `;
                        }).join('') : '<div style="color: rgba(255, 255, 255, 0.5); font-size: 12px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 6px;">无附件</div>';
                        
                        const levelName = levelNames[material.award_level] || '未知级别';
                        const gradeName = gradeNames[material.award_grade] || '未知等级';
                        
                        categoryItemsHtml += `
                            <div style="background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: 12px; margin-bottom: 20px; border: 1px solid rgba(255, 255, 255, 0.2); backdrop-filter: blur(8px);">
                                <div style="color: #fbbf24; font-weight: 700; margin-bottom: 8px; font-size: 16px; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);">
                                    ${index + 1}. ${material.item_name}
                                </div>
                                <div style="color: #ffffff; font-size: 14px; margin-bottom: 15px; background: rgba(255, 255, 255, 0.1); padding: 10px 15px; border-radius: 8px; font-weight: 600;">
                                    ${levelName} ${gradeName} - 得分: <span style="color: #22c55e; font-weight: 700; font-size: 16px;">${material.score}分</span>
                                </div>
                                <div style="color: #ffffff; font-size: 14px; margin-bottom: 12px; font-weight: 600;">附件:</div>
                                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                    ${filesHtml}
                                </div>
                            </div>
                        `;
                    });
                    
                    materialsHtml += `
                        <div style="margin-bottom: 25px;">
                            <h4 style="color: #ffffff; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; font-size: 20px; font-weight: 700; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);">
                                <span>${categoryName}</span>
                                <span style="color: #22c55e; font-size: 16px; background: rgba(34, 197, 94, 0.3); padding: 8px 16px; border-radius: 12px; font-weight: 700; border: 1px solid rgba(34, 197, 94, 0.4);">
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
            
            // 创建模态框显示详情
            const detailModal = document.createElement('div');
            detailModal.className = 'announcement-modal';
            detailModal.innerHTML = `
                <div class="announcement-content application-detail-content" style="min-width: 900px; max-width: 1200px; width: 90vw; max-height: 90vh; overflow-y: auto; padding: 40px; background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 2px solid rgba(255, 255, 255, 0.25); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);">
                    <div class="announcement-header" style="margin-bottom: 30px; border-bottom: 2px solid rgba(255, 255, 255, 0.2); padding-bottom: 20px;">
                        <h2 class="announcement-title" style="color: #ffffff; font-size: 28px; font-weight: 700; text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);">申请详情</h2>
                        <button class="announcement-close" onclick="this.closest('.announcement-modal').remove()" style="color: #ffffff; font-size: 32px; font-weight: bold;">×</button>
                    </div>
                    <div class="announcement-body">
                        <div style="background: rgba(255, 255, 255, 0.2); padding: 25px; border-radius: 15px; margin-bottom: 30px; border: 1px solid rgba(255, 255, 255, 0.3); backdrop-filter: blur(10px);">
                            <div style="color: #ffffff; margin-bottom: 15px; font-size: 16px; font-weight: 600;"><strong>批次:</strong> <span style="color: #fbbf24; font-weight: 700;">${application.batch_name}</span></div>
                            <div style="color: #ffffff; margin-bottom: 15px; font-size: 16px; font-weight: 600;"><strong>状态:</strong> 
                                <span style="color: ${application.status === 'pending' ? '#fbbf24' : application.status === 'approved' ? '#22c55e' : '#ef4444'}; font-weight: 700; padding: 4px 12px; background: rgba(255, 255, 255, 0.1); border-radius: 8px;">
                                    ${statusText[application.status]}
                                </span>
                            </div>
                            <div style="color: #ffffff; margin-bottom: 15px; font-size: 16px; font-weight: 600;"><strong>提交时间:</strong> <span style="color: #60a5fa;">${formatDate(application.submitted_at)}</span></div>
                            <div style="color: #ffffff; font-size: 18px; font-weight: 600;"><strong>总分:</strong> <span style="color: #22c55e; font-weight: 700; font-size: 24px; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);">${application.total_score || 0}分</span></div>
                        </div>
                        ${materialsHtml || '<div style="color: rgba(255, 255, 255, 0.8); padding: 30px; text-align: center; font-size: 18px; background: rgba(255, 255, 255, 0.1); border-radius: 15px;">暂无申报材料</div>'}
                        ${application.review_comment ? `
                            <div style="background: rgba(255, 255, 255, 0.2); padding: 25px; border-radius: 15px; margin-top: 30px; border: 1px solid rgba(255, 255, 255, 0.3);">
                                <div style="color: #ffffff; font-size: 18px; font-weight: 700; margin-bottom: 15px; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);">审核意见:</div>
                                <div style="color: #ffffff; font-size: 16px; line-height: 1.6; background: rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 10px;">${application.review_comment}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
            document.body.appendChild(detailModal);
        } else {
            alert('获取申请详情失败：' + (response.message || '未知错误'));
        }
    } catch (error) {
        console.error('Error viewing application:', error);
        alert('查看申请失败：' + error.message);
    }
}

// 工具函数
function formatDate(dateString) {
    if (!dateString || dateString === 'undefined' || dateString === 'null') {
        return '未设置';
    }
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return '无效日期';
        }
        return date.toLocaleString('zh-CN');
    } catch (error) {
        console.error('Date formatting error:', error, 'for date:', dateString);
        return '日期错误';
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(fileType) {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('doc')) return '📝';
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
    return '📎';
}

// 申请表单管理
function renderCategories(batchId) {
    const container = document.getElementById('categoriesContainer');
    container.innerHTML = '';
    
    // 确保类目数据已加载
    if (!categories || categories.length === 0) {
        console.log('Categories not loaded, attempting to load...');
        DataManager.loadCategories().then(() => {
            renderCategories(batchId);
        }).catch(error => {
            console.error('Failed to load categories:', error);
            container.innerHTML = '<div class="error-message">无法加载奖学金类目，请刷新页面重试</div>';
        });
        return;
    }
    
    categories.forEach(category => {
        // 修复：允许显示没有奖项的类目，但给出提示
        if (!category.items || !Array.isArray(category.items)) {
            category.items = [];
        }
        
        if (category.items.length === 0) {
            console.warn(`Category ${category.name} has no items`);
            // 不再return，而是继续显示类目但添加提示
        }
        
        const categoryEl = document.createElement('div');
        categoryEl.className = 'category-section';
        
        const hasItems = category.items && category.items.length > 0;
        const noItemsWarning = hasItems ? '' : `
            <div style="background: rgba(255, 193, 7, 0.2); border: 1px solid rgba(255, 193, 7, 0.5); border-radius: 8px; padding: 12px; margin-bottom: 15px; color: #ffc107;">
                ⚠️ 该类目还没有预设的奖项，请联系管理员先添加奖项?            </div>
        `;
        
        categoryEl.innerHTML = `
            <div class="category-title">${category.name}</div>
            <div class="category-score">总分权重: ${category.score} 分 </div>
            ${noItemsWarning}
            
            <div id="itemsContainer${category.id}">
                <!-- 已添加的奖项将在这里显示 -->
            </div>
            
            <button class="btn-outline btn" onclick="addNewItem(${category.id})" style="width: 100%; margin-top: 15px;" ${!hasItems ? 'disabled title="该类目没有可选奖项"' : ''}>
                添加${category.name}奖项
            </button>
        `;
        
        container.appendChild(categoryEl);
    });
    
    // 如果是编辑模式，加载已有数据
    if (currentApplication && currentApplication.materials) {
        console.log('Loading existing materials for edit mode:', currentApplication.materials);
        currentApplication.materials.forEach((material, index) => {
            const itemIndex = `edit_${material.id}_${index}`;
            console.log(`Adding material to category ${material.category_id} with index ${itemIndex}:`, material);
            addItemToCategory(material.category_id, material, itemIndex);
        });
    }
    
    // 确保提交按钮有正确的初始状态
    forceResetSubmitButton();
}

function addNewItem(categoryId) {
    // 确保categories数据已加载
    if (!categories || categories.length === 0) {
        console.error('Categories not loaded');
        alert('类目数据未加载，请刷新页面重试');
        return;
    }
    
    console.log('Adding new item for category:', categoryId, 'type:', typeof categoryId);
    console.log('Available categories:', categories);
    console.log('Category IDs:', categories.map(c => ({ id: c.id, type: typeof c.id, name: c.name })));
    
    // 修复：确保categoryId类型匹配，统一转为数字进行比较
    const numericCategoryId = parseInt(categoryId);
    const category = categories.find(c => parseInt(c.id) === numericCategoryId);
    if (!category) {
        console.error('Category not found:', categoryId, 'numeric:', numericCategoryId);
        console.error('Available category IDs:', categories.map(c => c.id));
        alert('找不到指定的类目');
        return;
    }
    
    // 修复：如果items不存在或为空，初始化为空数组
    if (!category.items || !Array.isArray(category.items)) {
        console.warn('Category items not properly initialized, setting to empty array:', category);
        category.items = [];
    }
    
    // 如果没有奖项，提示用户但仍允许添加
    if (category.items.length === 0) {
        console.warn('Category has no items:', category);
        alert('该类目还没有预设的奖项，请联系管理员先添加奖项到该类目');
        return;
    }
    
    let itemOptions = '<option value="">请选择具体项目</option>';
    category.items.forEach(item => {
        itemOptions += `<option value="${item.id}">${item.name}</option>`;
    });
    
    const itemIndex = Date.now();
    addItemToCategory(categoryId, null, itemIndex, itemOptions);
}

function addItemToCategory(categoryId, itemData = null, itemIndex, itemOptions = null) {
    const container = document.getElementById(`itemsContainer${categoryId}`);
    // 修复：确保categoryId类型匹配
    const numericCategoryId = parseInt(categoryId);
    const category = categories.find(c => parseInt(c.id) === numericCategoryId);
    
    if (!container) {
        console.error('Container not found for category:', categoryId);
        return;
    }
    
    if (!category) {
        console.error('Category not found:', categoryId);
        return;
    }
    
    if (!itemOptions) {
        itemOptions = '<option value="">请选择具体项目</option>';
        if (category.items && category.items.length > 0) {
            category.items.forEach(item => {
                const selected = itemData && parseInt(itemData.item_id) === parseInt(item.id) ? 'selected' : '';
                itemOptions += `<option value="${item.id}" ${selected}>${item.name}</option>`;
            });
        }
    }
    
    // 级别和等级选项
    let levelOptions = '';
    awardLevels.forEach(level => {
        const selected = itemData && itemData.award_level === level ? 'selected' : '';
        levelOptions += `<option value="${level}" ${selected}>${levelNames[level]}</option>`;
    });
    
    let gradeOptions = '';
    awardGrades.forEach(grade => {
        const selected = itemData && itemData.award_grade === grade ? 'selected' : '';
        gradeOptions += `<option value="${grade}" ${selected}>${gradeNames[grade]}</option>`;
    });
    
    const itemEl = document.createElement('div');
    itemEl.className = 'item-entry';
    itemEl.id = `itemEntry${categoryId}_${itemIndex}`;
    
    // 预填分数 - 编辑模式下不预填，让系统重新计算
    const prefilledScore = (itemData && !itemIndex.includes('edit_')) ? itemData.score : '';
    
    itemEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h4 style="color: white; margin: 0;">奖项 #${container.children.length + 1}</h4>
            <button class="file-remove" onclick="removeItemEntry(${categoryId}, '${itemIndex}')">删除奖项</button>
        </div>
        
        <div class="form-row-double">
            <div class="form-group">
                <label class="form-label">奖项名称</label>
                <select class="form-select" id="itemSelect${categoryId}_${itemIndex}" onchange="updateItemSelection(${categoryId}, '${itemIndex}')">
                    ${itemOptions}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">获奖级别</label>
                <select class="form-select" id="levelSelect${categoryId}_${itemIndex}" onchange="updateScoreCalculation(${categoryId}, '${itemIndex}')">
                    ${levelOptions}
                </select>
            </div>
        </div>
        
        <div class="form-row-double">
            <div class="form-group">
                <label class="form-label">获奖等级</label>
                <select class="form-select" id="gradeSelect${categoryId}_${itemIndex}" onchange="updateScoreCalculation(${categoryId}, '${itemIndex}')">
                    ${gradeOptions}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">得分</label>
                <input type="number" class="form-input" id="scoreInput${categoryId}_${itemIndex}" value="${prefilledScore}" readonly>
            </div>
        </div>
        
        <div class="form-group">
            <label class="form-label">上传证明文件</label>
            <div class="file-upload" onclick="selectFilesForItem(${categoryId}, ${itemIndex})" id="fileUpload${categoryId}_${itemIndex}">
                <div class="upload-icon">📁</div>
                <div class="upload-text">点击上传文件<br>支持 JPG、PNG、PDF、DOC、DOCX 格式</div>
                <input type="file" id="fileInput${categoryId}_${itemIndex}" style="display: none;" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif" onchange="handleItemFileSelect(${categoryId}, ${itemIndex}, this)">
            </div>
            <div class="file-list" id="fileList${categoryId}_${itemIndex}">
                <!-- 文件列表将在这里显示 -->
            </div>
        </div>
    `;
    
    container.appendChild(itemEl);
    
    // 如果有预填数据，加载现有文件
    if (itemData && itemData.files) {
        loadExistingFiles(categoryId, itemIndex, itemData.files);
    }
    
    // 触发分数计算 - 对于编辑模式，强制重新计算分数
    if (itemData) {
        setTimeout(() => {
            updateScoreCalculation(categoryId, itemIndex);
            // 如果是编辑模式，再次确保分数正确计算
            if (itemIndex.includes('edit_')) {
                setTimeout(() => updateScoreCalculation(categoryId, itemIndex), 200);
            }
        }, 100);
    }
    
    updateItemNumbers(categoryId);
}

function removeItemEntry(categoryId, itemIndex) {
    const itemEntry = document.getElementById(`itemEntry${categoryId}_${itemIndex}`);
    if (itemEntry) {
        itemEntry.remove();
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
    const itemSelect = document.getElementById(`itemSelect${categoryId}_${itemIndex}`);
    const fileUpload = document.getElementById(`fileUpload${categoryId}_${itemIndex}`);
    const selectedItemId = itemSelect.value;
    
    if (selectedItemId) {
        // 启用文件上传
        fileUpload.classList.add('enabled');
        
        // 触发分数重新计算
        updateScoreCalculation(categoryId, itemIndex);
    } else {
        // 禁用文件上传
        fileUpload.classList.remove('enabled');
        
        // 清空分数
        const scoreInput = document.getElementById(`scoreInput${categoryId}_${itemIndex}`);
        if (scoreInput) {
            scoreInput.value = '';
        }
    }
}

function updateScoreCalculation(categoryId, itemIndex) {
    const itemSelect = document.getElementById(`itemSelect${categoryId}_${itemIndex}`);
    const levelSelect = document.getElementById(`levelSelect${categoryId}_${itemIndex}`);
    const gradeSelect = document.getElementById(`gradeSelect${categoryId}_${itemIndex}`);
    const scoreInput = document.getElementById(`scoreInput${categoryId}_${itemIndex}`);
    
    if (!itemSelect || !levelSelect || !gradeSelect || !scoreInput) {
        console.error('Score calculation elements not found for:', categoryId, itemIndex);
        return;
    }
    
    const selectedItemId = itemSelect.value;
    const selectedLevel = levelSelect.value;
    const selectedGrade = gradeSelect.value;
    
    if (!selectedItemId || !selectedLevel || !selectedGrade) {
        scoreInput.value = '';
        return;
    }
    
    // 查找对应的分数配置
    try {
        // 首先从categories中找到对应的item
        const numericCategoryId = parseInt(categoryId);
        const category = categories.find(c => parseInt(c.id) === numericCategoryId);
        
        if (!category || !category.items) {
            console.error('Category or items not found:', categoryId);
            scoreInput.value = '0';
            return;
        }
        
        const item = category.items.find(i => parseInt(i.id) === parseInt(selectedItemId));
        if (!item) {
            console.error('Item not found:', selectedItemId);
            scoreInput.value = '0';
            return;
        }
        
        // 查找分数配置
        let score = 0;
        const scoreKey = `${selectedLevel}_${selectedGrade}`;
        
        console.log('updateScoreCalculation 调试:', {
            categoryId: categoryId,
            itemIndex: itemIndex,
            selectedItemId: selectedItemId,
            selectedLevel: selectedLevel,
            selectedGrade: selectedGrade,
            scoreKey: scoreKey,
            item: item,
            itemScores: item ? item.scores : null,
            isEditMode: itemIndex.includes('edit_')
        });
        
        if (item.scores) {
            // 优先使用对象格式 (从后端API返回的格式)
            if (item.scores[scoreKey]) {
                score = parseInt(item.scores[scoreKey]) || 0;
                console.log(`使用对象格式分数: ${scoreKey} = ${score}`);
            }
            // 备用：检查数组格式
            else if (Array.isArray(item.scores)) {
                const scoreConfig = item.scores.find(s => 
                    s.level === selectedLevel && s.grade === selectedGrade
                );
                if (scoreConfig) {
                    score = parseInt(scoreConfig.score) || 0;
                    console.log(`使用数组格式分数: ${score}`);
                }
            } else {
                console.log('scores格式不匹配，可用键:', Object.keys(item.scores));
            }
        } else {
            console.log('item.scores不存在');
        }
        
        console.log(`最终分数: ${score}`);
        scoreInput.value = score;
        
    } catch (error) {
        console.error('Error calculating score:', error);
        scoreInput.value = '0';
    }
}

// 文件上传管理 - 按照成功样例重写
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
    const fileUpload = document.getElementById(`fileUpload${categoryId}_${itemIndex}`);
    if (!fileUpload) {
        console.error('File upload element not found:', `fileUpload${categoryId}_${itemIndex}`);
        alert('无法找到文件上传区域，请刷新页面重试');
        return;
    }
    
    const originalContent = fileUpload.innerHTML;
    fileUpload.innerHTML = '<div class="upload-progress">上传中... </div>';
    
    try {
        // 上传所有文件
        const uploadPromises = files.map(file => uploadFile(file));
        const uploadedFiles = await Promise.all(uploadPromises);
        
        console.log('Upload results:', uploadedFiles);
        
        // 初始化tempFiles
        if (!window.tempFiles) window.tempFiles = {};
        const key = `${categoryId}_${itemIndex}`;
        if (!window.tempFiles[key]) window.tempFiles[key] = [];
        
        // 添加上传成功的文件到临时存储
        uploadedFiles.forEach(fileData => {
            window.tempFiles[key].push({
                name: fileData.name,
                size: fileData.size,
                type: fileData.type,
                uploadTime: fileData.uploadTime,
                url: fileData.url,
                path: fileData.path,
                // 添加额外的属性以便提交时使用
                original_name: fileData.name,
                file_name: fileData.path,
                file_path: fileData.path,
                file_size: fileData.size,
                file_type: fileData.type,
                isExisting: false  // 标记为新上传的文件
            });
        });
        
        // 更新文件列表显示
        renderItemFileList(categoryId, itemIndex, window.tempFiles[key]);
        
        // 恢复上传区域
        fileUpload.innerHTML = originalContent;
        input.value = ''; // 清空文件选择
        
    } catch (error) {
        console.error('File upload error:', error);
        alert('文件上传失败: ' + error.message);
        fileUpload.innerHTML = originalContent;
        input.value = ''; // 清空文件选择
    }
}

async function uploadFile(file) {
    if (!file) {
        throw new Error('无效的文件');
    }
    
    // 检查文件大小 (10MB限制)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        throw new Error(`文件 ${file.name} 大小超过10MB限制`);
    }
    
    // 检查文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
        throw new Error(`文件 ${file.name} 类型不支持，请上传 JPG、PNG、GIF、PDF、DOC、DOCX 格式的文件`);
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
        
        console.log('Upload response status:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Upload response error:', errorText);
            throw new Error(`HTTP错误 ${response.status}: ${response.statusText}`);
        }
        
        const responseText = await response.text();
        console.log('Upload response text:', responseText);
        
        let result;
        
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON解析错误:', responseText);
            throw new Error('服务器返回非JSON格式响应：' + responseText.substring(0, 100));
        }
        
        if (!result.success) {
            console.error('Upload failed with result:', result);
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
    
    // 确保files是数组
    if (!Array.isArray(files)) {
        console.error('Files is not an array:', files);
        return;
    }
    
    window.tempFiles[key] = files.map(file => ({
        name: file.original_name || file.file_name || file.name,
        size: file.file_size || file.size,
        type: file.file_type || file.type,
        uploadTime: file.upload_time ? formatDate(file.upload_time) : '',
        url: file.file_path ? (file.file_path.startsWith('uploads/') ? file.file_path : 'uploads/' + file.file_path) : '',
        path: file.file_path || file.path,
        id: file.id,
        isExisting: true  // 标记为已存在的文件
    }));
    
    console.log(`Loading existing files for ${key}:`, window.tempFiles[key]);
    renderItemFileList(categoryId, itemIndex, window.tempFiles[key]);
}   

function renderItemFileList(categoryId, itemIndex, files) {
    const container = document.getElementById(`fileList${categoryId}_${itemIndex}`);
    container.innerHTML = '';
    
    files.forEach((file, fileIndex) => {
        const fileEl = document.createElement('div');
        fileEl.className = 'file-item';
        
        // 为已存在的文件添加标识
        const existingLabel = file.isExisting ? '<span style="color: #22c55e; font-size: 10px; background: rgba(34, 197, 94, 0.2); padding: 2px 6px; border-radius: 4px; margin-left: 8px;">已有</span>' : '';
        
        fileEl.innerHTML = `
            <div style="display: flex; align-items: center; flex: 1;">
                <span class="file-name">${file.name}</span>
                ${existingLabel}
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
    const titleElement = document.getElementById('currentBatchTitle');
    const batchId = parseInt(titleElement ? titleElement.dataset.batchId : 0);
    
    console.log('提交申请 - 调试信息:', {
        titleElement: titleElement,
        datasetBatchId: titleElement ? titleElement.dataset.batchId : 'null',
        batchId: batchId
    });
    
    if (!batchId || batchId === 0) {
        alert('无法获取批次ID，请刷新页面重试');
        return;
    }
    
    // 收集所有申请数据
    const applicationData = [];
    
    console.log('开始收集申请数据:', {
        categories: categories,
        currentApplication: currentApplication,
        tempFiles: window.tempFiles
    });
    
    categories.forEach(category => {
        const container = document.getElementById(`itemsContainer${category.id}`);
        console.log(`检查类目 ${category.id}:`, {
            container: container,
            hasContainer: !!container,
            childrenCount: container ? container.children.length : 0
        });
        
        if (!container) return;
        
        Array.from(container.children).forEach((itemEl, index) => {
            console.log(`检查项目 ${index}:`, {
                itemEl: itemEl,
                itemElId: itemEl.id,
                itemIndex: itemEl.id.split('_')[1]
            });
            
            const itemIndex = itemEl.id.replace(/^itemEntry\d+_/, '');
            const itemSelect = document.getElementById(`itemSelect${category.id}_${itemIndex}`);
            const levelSelect = document.getElementById(`levelSelect${category.id}_${itemIndex}`);
            const gradeSelect = document.getElementById(`gradeSelect${category.id}_${itemIndex}`);
            
            console.log(`表单元素检查:`, {
                itemSelect: itemSelect,
                levelSelect: levelSelect,
                gradeSelect: gradeSelect,
                itemSelectValue: itemSelect?.value,
                levelSelectValue: levelSelect?.value,
                gradeSelectValue: gradeSelect?.value,
                hasAllElements: !!(itemSelect && levelSelect && gradeSelect),
                hasAllValues: !!(itemSelect?.value && levelSelect?.value && gradeSelect?.value)
            });
            
            if (itemSelect && itemSelect.value && levelSelect && gradeSelect) {
                const files = window.tempFiles && window.tempFiles[`${category.id}_${itemIndex}`] || [];
                
                console.log(`文件检查:`, {
                    key: `${category.id}_${itemIndex}`,
                    files: files,
                    filesLength: files.length,
                    tempFiles: window.tempFiles,
                    fileDetails: files.map(f => ({
                        name: f.name,
                        id: f.id,
                        isExisting: f.isExisting,
                        hasId: !!f.id,
                        hasIsExisting: !!f.isExisting
                    }))
                });
                
                // 计算分数
                const selectedItem = category.items.find(item => item.id == itemSelect.value);
                const scoreKey = `${levelSelect.value}_${gradeSelect.value}`;
                let score = 0;
                
                if (selectedItem && selectedItem.scores) {
                    // 检查scores是否为对象格式 (从后端API返回的格式)
                    if (selectedItem.scores[scoreKey]) {
                        score = parseInt(selectedItem.scores[scoreKey]) || 0;
                    }
                    // 检查scores是否为数组格式 (备用格式)
                    else if (Array.isArray(selectedItem.scores)) {
                        const scoreConfig = selectedItem.scores.find(s => 
                            s.level === levelSelect.value && s.grade === gradeSelect.value
                        );
                        if (scoreConfig) {
                            score = parseInt(scoreConfig.score) || 0;
                        }
                    }
                }
                
                // 检查是否是编辑模式下的已有项目（itemIndex包含edit_前缀）
                const isEditingExistingItem = itemIndex.includes('edit_');
                
                console.log('计算分数:', {
                    categoryId: category.id,
                    itemId: itemSelect.value,
                    level: levelSelect.value,
                    grade: gradeSelect.value,
                    scoreKey: scoreKey,
                    selectedItem: selectedItem,
                    itemScores: selectedItem ? selectedItem.scores : null,
                    score: score,
                    filesCount: files.length,
                    hasFiles: files.length > 0,
                    isUpdate: !!currentApplication,
                    isEditingExistingItem: isEditingExistingItem,
                    itemIndex: itemIndex
                });
                
                // 修复编辑逻辑：
                // 1. 新申请：必须有文件
                // 2. 编辑申请：只要有选择项目就提交（不管是否有文件，因为可能只是修改级别/等级）
                if (!currentApplication) {
                    // 新申请：必须有文件
                    if (files.length > 0) {
                        applicationData.push({
                            category_id: category.id,
                            item_id: parseInt(itemSelect.value),
                            award_level: levelSelect.value,
                            award_grade: gradeSelect.value,
                            score: score,
                            files: files.map(file => {
                                return {
                                    path: file.path,
                                    name: file.name,
                                    size: file.size,
                                    type: file.type,
                                    original_name: file.name,
                                    file_name: file.path,
                                    file_path: file.path,
                                    file_size: file.size,
                                    file_type: file.type,
                                    is_existing: false
                                };
                            })
                        });
                        console.log('新申请：添加项目到applicationData');
                    }
                } else {
                    // 编辑申请：只要有选择项目就提交
                    // 对于编辑模式，即使没有文件也要提交（可能是只修改了级别/等级）
                    applicationData.push({
                        category_id: category.id,
                        item_id: parseInt(itemSelect.value),
                        award_level: levelSelect.value,
                        award_grade: gradeSelect.value,
                        score: score,
                        files: files.map(file => {
                            // 如果文件有id或isExisting标记，说明是已存在的文件，保留原始信息
                            if (file.id || file.isExisting) {
                                return {
                                    id: file.id,
                                    path: file.path || file.url,
                                    name: file.name,
                                    size: file.size,
                                    type: file.type,
                                    original_name: file.name,
                                    file_name: file.path || file.url,
                                    file_path: file.path || file.url,
                                    file_size: file.size,
                                    file_type: file.type,
                                    is_existing: true
                                };
                            } else {
                                // 新上传的文件
                                return {
                                    path: file.path,
                                    name: file.name,
                                    size: file.size,
                                    type: file.type,
                                    original_name: file.name,
                                    file_name: file.path,
                                    file_path: file.path,
                                    file_size: file.size,
                                    file_type: file.type,
                                    is_existing: false
                                };
                            }
                        })
                    });
                    console.log('编辑申请：添加项目到applicationData');
                }
            } else {
                console.log('跳过项目：缺少必要的表单元素或值');
            }
        });
    });
    
    console.log('数据收集完成，applicationData:', applicationData);
    
    if (applicationData.length === 0) {
        console.log('调试信息 - applicationData为空:', {
            currentApplication: currentApplication,
            categories: categories,
            tempFiles: window.tempFiles,
            containers: categories.map(c => ({
                categoryId: c.id,
                container: document.getElementById(`itemsContainer${c.id}`),
                children: document.getElementById(`itemsContainer${c.id}`)?.children?.length || 0
            }))
        });
        
        if (currentApplication) {
            alert('请至少完成一个奖项的申报（选择项目）');
        } else {
            alert('请至少完成一个奖项的申报（选择项目并上传材料）');
        }
        return;
    }
    
    // 对于新申请，检查是否每个项目都有文件
    if (!currentApplication) {
        const itemsWithoutFiles = applicationData.filter(item => !item.files || item.files.length === 0);
        if (itemsWithoutFiles.length > 0) {
            alert('新申请时，每个奖项都必须上传证明材料');
            return;
        }
    }
    
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = '提交...';
    
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
        console.log('申请材料详情:', apiData.materials.map(m => ({
            category_id: m.category_id,
            item_id: m.item_id,
            award_level: m.award_level,
            award_grade: m.award_grade,
            score: m.score,
            filesCount: m.files.length,
            filesDetails: m.files.map(f => ({
                name: f.name,
                id: f.id,
                isExisting: f.is_existing,
                path: f.path || f.file_path
            }))
        })));
        
        const response = await ApiClient.post('api/applications.php', apiData);
        
        console.log('申请提交响应:', response);
        
        if (response.success) {
            if (currentApplication) {
                alert('申请更新成功！\n\n您的申请状态已重新变为"待审核"，请等待管理员审核。');
            } else {
                alert('申请提交成功！');
            }
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
    } finally {
        // 确保按钮状态总是能恢复
        forceResetSubmitButton();
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
        alert('请填写完整的公告信息');
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
            alert('公告发布成功');
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
            alert('已设置为当前公告');
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

// 管理员功能切换
function switchTab(tabName) {
    // 隐藏所有标签内容
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // 移除所有标签按钮的活跃状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 显示选中的标签内容
    const targetTab = document.getElementById(tabName + 'Tab');
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // 激活对应的标签按钮
    const activeBtn = document.querySelector(`.tab-btn[onclick="switchTab('${tabName}')"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // 根据标签名加载对应数据
    switch (tabName) {
        case 'overview':
            updateStats();
            break;
        case 'announcements':
            renderAnnouncementHistory();
            break;
        case 'batches':
            loadBatchesList();
            break;
        case 'categories':
            renderCategoryList();
            updateCategorySelect();
            break;
        case 'itemManagement':
            renderItemsList();
            updateCategorySelect();
            break;
        case 'userManagement':
            loadUsersList();
            break;
        case 'ranking':
            // 确保批次数据已加载，然后初始化排名界面
            (async () => {
                try {
                    if (!batches || batches.length === 0) {
                        await DataManager.loadBatches();
                    }
                    await initRankingTab();
                } catch (error) {
                    console.error('Failed to initialize ranking tab:', error);
                }
            })();
            break;
        case 'materials':
            renderStudentMaterials();
            break;
    }
}

async function updateStats() {
    try {
        const response = await ApiClient.get('api/applications.php?action=stats');
        if (response.success) {
            document.getElementById('totalApplications').textContent = response.data.total_applications || 0;
            document.getElementById('totalCategories').textContent = response.data.total_categories || 0;
        }
    } catch (error) {
        console.error('Error updating stats:', error);
        // 设置默认值
        document.getElementById('totalApplications').textContent = '0';
        document.getElementById('totalCategories').textContent = categories.length || 0;
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
            action: 'create',
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
            alert('类目添加成功');
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
            action: 'delete',
            id: id
        });
        
        if (response.success) {
            await DataManager.loadCategories();
            updateCategorySelect();
            renderCategoryList();
            updateStats();
            alert('类目删除成功');
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
            action: 'create_item',
            category_id: categoryId,
            name: itemName
        });
        
        if (response.success) {
            document.getElementById('categorySelectForItem').value = '';
            document.getElementById('newItemName').value = '';
            
            await DataManager.loadCategories();
            renderItemsList();
            alert('奖项添加成功！请设置各级别等级的分数');
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
            action: 'delete_item',
            id: itemId
        });
        
        if (response.success) {
            await DataManager.loadCategories();
            renderItemsList();
            alert('奖项删除成功');
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
            action: 'update_item_score',
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
                ${category.items.length} 个奖项            </h3>
            ${itemsHtml}
        `;
        
        container.appendChild(categorySection);
    });
}

// 材料审核
async function renderStudentMaterials() {
    const container = document.getElementById('studentMaterials');
    container.innerHTML = '<div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 20px;">加载中... </div>';
    
    try {
        const response = await ApiClient.get('api/applications.php?action=get_all');
        
        if (response.success && response.data && response.data.length > 0) {
            container.innerHTML = '';
            response.data.forEach(application => {
                const studentCard = document.createElement('div');
                studentCard.className = 'student-card';
                
                const statusText = {
                    'pending': '待审核',
                    'approved': '已通过',
                    'rejected': '已驳回'
                };
                
                const statusClass = `status-${application.status}`;
                
                studentCard.innerHTML = `
                    <div class="student-header" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
                        <div style="flex: 1; min-width: 0;">
                            <div style="color: white; font-weight: 600; font-size: 16px; margin-bottom: 8px;">${application.user_name || '未知用户'}</div>
                            <div style="color: rgba(255, 255, 255, 0.8); font-size: 13px; line-height: 1.5; margin-bottom: 12px;">
                                <div style="margin-bottom: 4px;"><strong>批次:</strong> ${application.batch_name || '未知批次'}</div>
                                <div style="margin-bottom: 4px;"><strong>提交时间:</strong> ${formatDate(application.submitted_at)}</div>
                                <div style="margin-bottom: 4px;"><strong>材料数量:</strong> ${application.material_count || 0} 个</div>
                                <div><strong>总分:</strong> <span style="color: #22c55e; font-weight: bold; font-size: 14px;">${application.total_score || 0} 分</span></div>
                            </div>
                            <span class="application-status ${statusClass}" style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500;">
                                ${statusText[application.status]}
                            </span>
                        </div>
                        <div class="action-buttons" style="display: flex; flex-direction: column; gap: 8px; min-width: 120px;">
                            <button class="btn btn-outline" onclick="viewApplicationDetail(${application.id})" style="padding: 8px 16px; font-size: 13px; white-space: nowrap;">查看详情</button>
                            <button class="btn-success btn" onclick="reviewApplication(${application.id}, 'approved')" style="padding: 8px 16px; font-size: 13px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); border: none;">通过</button>
                            <button class="btn-danger btn" onclick="reviewApplication(${application.id}, 'rejected')" style="padding: 8px 16px; font-size: 13px; background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); border: none;">驳回</button>
                            <button class="btn" onclick="deleteApplicationConfirm(${application.id}, '${application.user_name}')" style="padding: 8px 16px; font-size: 13px; background: linear-gradient(135deg, #7c2d12 0%, #dc2626 100%); border: none; color: white;">删除申请</button>
                        </div>
                    </div>
                    ${application.review_comment ? `
                        <div style="background: rgba(255, 255, 255, 0.1); padding: 10px; border-radius: 8px; margin: 15px 0;">
                            <div style="color: white; font-size: 12px; font-weight: 500;">审核意见:</div>
                            <div style="color: rgba(255, 255, 255, 0.8); font-size: 14px; margin-top: 5px;">${application.review_comment}</div>
                        </div>
                    ` : ''}
                `;
                
                container.appendChild(studentCard);
            });
        } else {
            container.innerHTML = '<div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 40px;">暂无学生申请</div>';
        }
        
    } catch (error) {
        console.error('Error rendering student materials:', error);
        container.innerHTML = '<div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 40px;">加载申请失败: ' + error.message + '</div>';
    }
}

async function reviewApplication(applicationId, status) {
    const comment = prompt(status === 'approved' ? '请输入通过理由（可选）:' : '请输入驳回理由');
    
    if (status === 'rejected' && (!comment || comment.trim() === '')) {
        alert('驳回申请必须填写理由');
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('action', 'review');
        formData.append('id', applicationId);
        formData.append('status', status);
        formData.append('comment', comment || '');
        
        const response = await fetch('api/applications.php', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`申请${status === 'approved' ? '通过' : '驳回'}！`);
            renderStudentMaterials();
        } else {
            throw new Error(data.message || '审核失败');
        }
    } catch (error) {
        console.error('Review application error:', error);
        alert('审核失败：' + error.message);
    }
}

async function requestModification(applicationId) {
    const comment = prompt('请输入修改要求');
    
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
            alert('修改要求已发送给学生');
            renderStudentMaterials();
        } else {
            throw new Error(response.message || '操作失败');
        }
    } catch (error) {
        console.error('Request modification error:', error);
        alert('操作失败：' + error.message);
    }
}

// 删除申请确认
async function deleteApplicationConfirm(applicationId, userName) {
    if (!confirm(`确定要删除 "${userName}" 的申请吗？删除后将无法恢复，包括所有相关的附件文件。`)) {
        return;
    }
    
    try {
        const response = await ApiClient.post('api/applications.php', {
            action: 'deleteApplication',
            id: applicationId
        });
        
        if (response.success) {
            alert('申请删除成功！');
            renderStudentMaterials();
        } else {
            throw new Error(response.message || '删除失败');
        }
    } catch (error) {
        console.error('Delete application error:', error);
        alert('删除失败：' + error.message);
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
            throw new Error(response.message || '获取用户列表失败');
        }
    } catch (error) {
        console.error('Load users list error:', error);
        const container = document.getElementById('usersList');
        if (container) {
            container.innerHTML = '<div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 40px;">加载用户列表失败</div>';
        }
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
                    创建时间: ${formatDate(user.created_at)}
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
    formData.append('action', 'add');
    formData.append('username', document.getElementById('newUsername').value);
    formData.append('type', document.getElementById('userType').value);
    formData.append('real_name', document.getElementById('realName').value);
    formData.append('email', document.getElementById('userEmail').value);
    formData.append('phone', document.getElementById('userPhone').value);
    formData.append('password', document.getElementById('addUserPassword').value);
    
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
            alert('用户添加成功');
            clearUserForm();
            loadUsersList();
        } else {
            throw new Error(data.message || '添加失败');
        }
    } catch (error) {
        console.error('Add/Update user error:', error);
        alert('添加用户失败：' + error.message);
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
            alert('用户更新成功');
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
            alert('用户删除成功');
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
    const studentFields = document.getElementById('studentFields');
    if (studentFields) {
        studentFields.style.display = 'none';
    }
    const submitBtn = document.querySelector('#userForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.textContent = '添加用户';
    }
}

// 下载用户导入模板
function downloadUserTemplate() {
    const link = document.createElement('a');
    link.href = 'api/users.php?action=download_template';
    link.download = '用户批量导入模板.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 处理文件选择
function handleUserImportFileSelect(event) {
    console.log('File select triggered', event.target.files);
    
    const file = event.target.files[0];
    const fileInfo = document.getElementById('importFileInfo');
    const fileName = document.getElementById('importFileName');
    const importBtn = document.getElementById('importUsersBtn');
    
    console.log('Elements found:', {
        fileInfo: !!fileInfo,
        fileName: !!fileName,
        importBtn: !!importBtn
    });
    
    if (file) {
        console.log('File selected:', file.name, file.size, file.type);
        
        // 检查文件类型
        if (!file.name.toLowerCase().endsWith('.csv')) {
            alert('请选择CSV格式的文件');
            event.target.value = '';
            return;
        }
        
        // 检查文件大小（5MB）
        if (file.size > 5 * 1024 * 1024) {
            alert('文件大小不能超过5MB');
            event.target.value = '';
            return;
        }
        
        if (fileName) {
            fileName.textContent = file.name;
        }
        if (fileInfo) {
            fileInfo.style.display = 'block';
        }
        if (importBtn) {
            importBtn.disabled = false;
            importBtn.style.opacity = '1';
            importBtn.style.cursor = 'pointer';
            console.log('Import button enabled');
        }
    } else {
        console.log('No file selected');
        if (fileInfo) {
            fileInfo.style.display = 'none';
        }
        if (importBtn) {
            importBtn.disabled = true;
            importBtn.style.opacity = '0.5';
            importBtn.style.cursor = 'not-allowed';
            console.log('Import button disabled');
        }
    }
}

// 批量导入用户
async function importUsers() {
    const fileInput = document.getElementById('userImportFile');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('请先选择要导入的文件');
        return;
    }
    
    const importBtn = document.getElementById('importUsersBtn');
    const progress = document.getElementById('importProgress');
    const progressBar = document.getElementById('importProgressBar');
    const progressText = document.getElementById('importProgressText');
    
    try {
        // 显示进度条
        progress.style.display = 'block';
        importBtn.disabled = true;
        progressBar.style.width = '20%';
        progressText.textContent = '准备上传文件...';
        
        // 创建FormData
        const formData = new FormData();
        formData.append('action', 'batch_import');
        formData.append('import_file', file);
        
        progressBar.style.width = '50%';
        progressText.textContent = '正在上传并处理文件...';
        
        // 发送请求
        const response = await fetch('api/users.php', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });
        
        progressBar.style.width = '80%';
        progressText.textContent = '处理服务器响应...';
        
        const data = await response.json();
        
        progressBar.style.width = '100%';
        progressText.textContent = '完成！';
        
        if (data.success) {
            // 显示详细结果
            let message = data.message;
            if (data.errors && data.errors.length > 0) {
                message += '\n\n详细错误信息：\n' + data.errors.slice(0, 20).join('\n');
                if (data.errors.length > 20) {
                    message += '\n...（还有 ' + (data.errors.length - 20) + ' 个错误）';
                }
            }
            
            alert(message);
            
            // 重新加载用户列表
            await loadUsersList();
            
            // 清理文件选择
            fileInput.value = '';
            document.getElementById('importFileInfo').style.display = 'none';
        } else {
            throw new Error(data.message || '导入失败');
        }
    } catch (error) {
        console.error('Import users error:', error);
        progressBar.style.width = '100%';
        progressBar.style.background = '#ef4444';
        progressText.textContent = '导入失败';
        alert('批量导入失败：' + error.message);
    } finally {
        // 恢复界面状态
        setTimeout(() => {
            progress.style.display = 'none';
            progressBar.style.width = '0%';
            progressBar.style.background = 'linear-gradient(90deg, #3b82f6, #06d6a0)';
            
            // 检查是否还有文件选中，决定按钮状态
            const fileInput = document.getElementById('userImportFile');
            if (fileInput && fileInput.files[0]) {
                importBtn.disabled = false;
                importBtn.style.opacity = '1';
                importBtn.style.cursor = 'pointer';
            } else {
                importBtn.disabled = true;
                importBtn.style.opacity = '0.5';
                importBtn.style.cursor = 'not-allowed';
            }
        }, 2000);
    }
}

// 查看申请详情
async function viewApplicationDetail(applicationId) {
    try {
        const response = await ApiClient.get(`api/applications.php?action=get_detail&id=${applicationId}`);
        
        if (response.success && response.data) {
            const application = response.data;
            
            let materialsHtml = '';
            
            if (application.materials && application.materials.length > 0) {
                const materialsByCategory = {};
                application.materials.forEach(material => {
                    if (!materialsByCategory[material.category_name]) {
                        materialsByCategory[material.category_name] = [];
                    }
                    materialsByCategory[material.category_name].push(material);
                });
                
                Object.keys(materialsByCategory).forEach(categoryName => {
                    const categoryItems = materialsByCategory[categoryName];
                    const categoryScore = categoryItems.reduce((sum, item) => sum + parseFloat(item.score || 0), 0);
                    
                    let categoryItemsHtml = '';
                    categoryItems.forEach((material, index) => {
                        const filesHtml = material.files && material.files.length > 0 ? material.files.map(file => {
                            const filePath = file.file_path.startsWith('uploads/') ? file.file_path : `uploads/${file.file_path}`;
                            const fileIcon = getFileIcon(file.file_type || file.original_name);
                            return `
                                <div style="margin: 5px; padding: 10px; background: rgba(255,255,255,0.15); border-radius: 8px; display: inline-block; min-width: 120px; border: 1px solid rgba(255,255,255,0.1); transition: all 0.3s ease; cursor: pointer;" onclick="previewFile('${filePath}', '${file.file_type}', '${file.original_name}')" onmouseover="this.style.background='rgba(255,255,255,0.25)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">
                                    <div style="color: white; font-size: 13px; margin-bottom: 4px; word-break: break-all;">
                                        ${fileIcon} ${file.original_name}
                                    </div>
                                    <div style="color: rgba(255, 255, 255, 0.6); font-size: 11px;">${formatFileSize(file.file_size)}</div>
                                </div>
                            `;
                        }).join('') : '<div style="color: rgba(255, 255, 255, 0.5); font-size: 12px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 6px;">无附件</div>';
                        
                        const levelName = levelNames[material.award_level] || '未知级别';
                        const gradeName = gradeNames[material.award_grade] || '未知等级';
                        
                        categoryItemsHtml += `
                            <div style="background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: 12px; margin-bottom: 20px; border: 1px solid rgba(255, 255, 255, 0.2); backdrop-filter: blur(8px);">
                                <div style="color: #fbbf24; font-weight: 700; margin-bottom: 8px; font-size: 16px; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);">
                                    ${index + 1}. ${material.item_name}
                                </div>
                                <div style="color: #ffffff; font-size: 14px; margin-bottom: 15px; background: rgba(255, 255, 255, 0.1); padding: 10px 15px; border-radius: 8px; font-weight: 600;">
                                    ${levelName} ${gradeName} - 得分: <span style="color: #22c55e; font-weight: 700; font-size: 16px;">${material.score}分</span>
                                </div>
                                <div style="color: #ffffff; font-size: 14px; margin-bottom: 12px; font-weight: 600;">附件:</div>
                                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                    ${filesHtml}
                                </div>
                            </div>
                        `;
                    });
                    
                    materialsHtml += `
                        <div style="margin-bottom: 25px;">
                            <h4 style="color: #ffffff; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; font-size: 20px; font-weight: 700; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);">
                                <span>${categoryName}</span>
                                <span style="color: #22c55e; font-size: 16px; background: rgba(34, 197, 94, 0.3); padding: 8px 16px; border-radius: 12px; font-weight: 700; border: 1px solid rgba(34, 197, 94, 0.4);">
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
            
            // 创建模态框显示详情
            const detailModal = document.createElement('div');
            detailModal.className = 'announcement-modal';
            detailModal.innerHTML = `
                <div class="announcement-content application-detail-content" style="min-width: 900px; max-width: 1200px; width: 90vw; max-height: 90vh; overflow-y: auto; padding: 40px; background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 2px solid rgba(255, 255, 255, 0.25); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);">
                    <div class="announcement-header" style="margin-bottom: 30px; border-bottom: 2px solid rgba(255, 255, 255, 0.2); padding-bottom: 20px;">
                        <h2 class="announcement-title" style="color: #ffffff; font-size: 28px; font-weight: 700; text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);">申请详情</h2>
                        <button class="announcement-close" onclick="this.closest('.announcement-modal').remove()" style="color: #ffffff; font-size: 32px; font-weight: bold;">×</button>
                    </div>
                    <div class="announcement-body">
                        <div style="background: rgba(255, 255, 255, 0.2); padding: 25px; border-radius: 15px; margin-bottom: 30px; border: 1px solid rgba(255, 255, 255, 0.3); backdrop-filter: blur(10px);">
                            <div style="color: #ffffff; margin-bottom: 15px; font-size: 16px; font-weight: 600;"><strong>批次:</strong> <span style="color: #fbbf24; font-weight: 700;">${application.batch_name}</span></div>
                            <div style="color: #ffffff; margin-bottom: 15px; font-size: 16px; font-weight: 600;"><strong>状态:</strong> 
                                <span style="color: ${application.status === 'pending' ? '#fbbf24' : application.status === 'approved' ? '#22c55e' : '#ef4444'}; font-weight: 700; padding: 4px 12px; background: rgba(255, 255, 255, 0.1); border-radius: 8px;">
                                    ${statusText[application.status]}
                                </span>
                            </div>
                            <div style="color: #ffffff; margin-bottom: 15px; font-size: 16px; font-weight: 600;"><strong>提交时间:</strong> <span style="color: #60a5fa;">${formatDate(application.submitted_at)}</span></div>
                            <div style="color: #ffffff; font-size: 18px; font-weight: 600;"><strong>总分:</strong> <span style="color: #22c55e; font-weight: 700; font-size: 24px; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);">${application.total_score || 0}分</span></div>
                        </div>
                        ${materialsHtml || '<div style="color: rgba(255, 255, 255, 0.8); padding: 30px; text-align: center; font-size: 18px; background: rgba(255, 255, 255, 0.1); border-radius: 15px;">暂无申报材料</div>'}
                        ${application.review_comment ? `
                            <div style="background: rgba(255, 255, 255, 0.2); padding: 25px; border-radius: 15px; margin-top: 30px; border: 1px solid rgba(255, 255, 255, 0.3);">
                                <div style="color: #ffffff; font-size: 18px; font-weight: 700; margin-bottom: 15px; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);">审核意见:</div>
                                <div style="color: #ffffff; font-size: 16px; line-height: 1.6; background: rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 10px;">${application.review_comment}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
            document.body.appendChild(detailModal);
        } else {
            alert('获取申请详情失败：' + (response.message || '未知错误'));
        }
    } catch (error) {
        console.error('Error viewing application:', error);
        alert('查看申请失败：' + error.message);
    }
}

// 批次管理相关函数
async function loadBatchesList() {
    try {
        const response = await ApiClient.get('api/applications.php?action=getBatches');
        if (response.success) {
            renderBatchesList(response.batches || response.data || []);
        } else {
            throw new Error(response.message || '获取批次列表失败');
        }
    } catch (error) {
        console.error('Load batches list error:', error);
        const container = document.getElementById('batchesList');
        if (container) {
            container.innerHTML = '<div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 40px;">加载批次列表失败</div>';
        }
    }
}

function renderBatchesList(batches) {
    const container = document.getElementById('batchesList');
    
    if (!container) return;
    
    if (batches.length === 0) {
        container.innerHTML = '<div style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 40px;">暂无批次</div>';
        return;
    }
    
    container.innerHTML = batches.map(batch => {
        const statusText = batch.status === 'open' ? '开放' : '关闭';
        const statusClass = batch.status === 'open' ? 'status-approved' : 'status-rejected';
        
        return `
            <div class="user-item" style="margin-bottom: 15px;">
                <div style="flex: 1;">
                    <div style="color: white; font-weight: 600; margin-bottom: 5px;">${batch.name}</div>
                    <div style="color: rgba(255, 255, 255, 0.7); font-size: 13px; margin-bottom: 5px;">
                        ${batch.description || '无描述'}
                    </div>
                    <div style="color: rgba(255, 255, 255, 0.6); font-size: 12px;">
                        开放: ${formatDate(batch.start_date)} | 结束: ${formatDate(batch.end_date)}
                    </div>
                    <span class="application-status ${statusClass}" style="margin-top: 8px; display: inline-block;">
                        ${statusText}
                    </span>
                </div>
                <div class="user-actions">
                    <button class="btn btn-outline" onclick="editBatch(${batch.id})">编辑</button>
                    <button class="btn-danger btn" onclick="deleteBatchItem(${batch.id}, '${batch.name}')">删除</button>
                </div>
            </div>
        `;
    }).join('');
}

async function addBatch() {
    const name = document.getElementById('batchName').value.trim();
    const description = document.getElementById('batchDescription').value.trim();
    const startDate = document.getElementById('batchStartDate').value;
    const endDate = document.getElementById('batchEndDate').value;
    const status = document.getElementById('batchStatus').value;
    
    console.log('Batch form data:', { name, description, startDate, endDate, status });
    console.log('Form element values:', {
        nameEl: document.getElementById('batchName'),
        nameValue: document.getElementById('batchName')?.value,
        startDateEl: document.getElementById('batchStartDate'),
        startDateValue: document.getElementById('batchStartDate')?.value,
        endDateEl: document.getElementById('batchEndDate'),
        endDateValue: document.getElementById('batchEndDate')?.value,
        statusEl: document.getElementById('batchStatus'),
        statusValue: document.getElementById('batchStatus')?.value
    });
    
    if (!name) {
        alert('请填写批次名称');
        return;
    }
    
    if (!startDate) {
        alert('请选择开始日期');
        return;
    }
    
    if (!endDate) {
        alert('请选择结束日期');
        return;
    }
    
    if (!status) {
        alert('请选择状态');
        return;
    }
    
    if (new Date(startDate) >= new Date(endDate)) {
        alert('结束日期必须晚于开始日期！');
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('action', 'addBatch');
        formData.append('name', name);
        formData.append('description', description);
        formData.append('start_date', startDate);
        formData.append('end_date', endDate);
        formData.append('status', status);
        
        console.log('Sending batch data:', {
            action: 'addBatch',
            name,
            description,
            start_date: startDate,
            end_date: endDate,
            status
        });
        
        // 打印FormData内容
        console.log('FormData contents:');
        for (let [key, value] of formData.entries()) {
            console.log(`${key}: ${value}`);
        }
        
        const response = await fetch('api/applications.php', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        const responseText = await response.text();
        console.log('Raw response:', responseText);
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            alert('服务器返回了无效的JSON响应: ' + responseText);
            return;
        }
        
        if (data.success) {
            alert('批次添加成功');
            clearBatchForm();
            loadBatchesList();
        } else {
            throw new Error(data.message || '添加失败');
        }
    } catch (error) {
        console.error('Add batch error:', error);
        alert('添加批次失败：' + error.message);
    }
}

function clearBatchForm() {
    document.getElementById('batchName').value = '';
    document.getElementById('batchDescription').value = '';
    document.getElementById('batchStartDate').value = '';
    document.getElementById('batchEndDate').value = '';
    document.getElementById('batchStatus').value = 'open';
}

let currentEditingBatch = null;

async function editBatch(batchId) {
    try {
        // 获取批次详情
        const response = await ApiClient.get('api/applications.php?action=getBatches');
        if (response.success) {
            const batch = (response.batches || response.data || []).find(b => b.id == batchId);
            if (batch) {
                currentEditingBatch = batch;
                showEditBatchModal(batch);
            } else {
                alert('批次不存在');
            }
        }
    } catch (error) {
        console.error('Edit batch error:', error);
        alert('获取批次信息失败：' + error.message);
    }
}

function showEditBatchModal(batch) {
    const modal = document.createElement('div');
    modal.className = 'announcement-modal';
    modal.innerHTML = `
        <div class="announcement-content" style="min-width: 700px; max-width: 900px; width: 80vw; padding: 40px; background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 2px solid rgba(255, 255, 255, 0.25); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);">
            <div class="announcement-header" style="margin-bottom: 30px; border-bottom: 2px solid rgba(255, 255, 255, 0.2); padding-bottom: 20px;">
                <h2 class="announcement-title" style="color: #ffffff; font-size: 28px; font-weight: 700; text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);">编辑批次</h2>
                <button class="announcement-close" onclick="this.closest('.announcement-modal').remove()" style="color: #ffffff; font-size: 32px; font-weight: bold;">×</button>
            </div>
            <div class="announcement-body">
                <form id="editBatchForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label" style="color: #ffffff; font-weight: 600; font-size: 16px;">批次名称</label>
                            <input type="text" id="editBatchName" class="form-input" value="${batch.name}" required style="background: rgba(255, 255, 255, 0.2); color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.3);">
                        </div>
                        <div class="form-group">
                            <label class="form-label" style="color: #ffffff; font-weight: 600; font-size: 16px;">批次描述</label>
                            <input type="text" id="editBatchDescription" class="form-input" value="${batch.description || ''}" style="background: rgba(255, 255, 255, 0.2); color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.3);">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label" style="color: #ffffff; font-weight: 600; font-size: 16px;">开始日期</label>
                            <input type="date" id="editBatchStartDate" class="form-input" value="${batch.start_date}" required style="background: rgba(255, 255, 255, 0.2); color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.3);">
                        </div>
                        <div class="form-group">
                            <label class="form-label" style="color: #ffffff; font-weight: 600; font-size: 16px;">结束日期</label>
                            <input type="date" id="editBatchEndDate" class="form-input" value="${batch.end_date}" required style="background: rgba(255, 255, 255, 0.2); color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.3);">
                        </div>
                        <div class="form-group">
                            <label class="form-label" style="color: #ffffff; font-weight: 600; font-size: 16px;">状态</label>
                            <select id="editBatchStatus" class="form-select" required style="background: rgba(255, 255, 255, 0.2); color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.3);">
                                <option value="open" ${batch.status === 'open' ? 'selected' : ''}>开放</option>
                                <option value="closed" ${batch.status === 'closed' ? 'selected' : ''}>关闭</option>
                            </select>
                        </div>
                    </div>
                </form>
            </div>
            <div class="announcement-footer" style="margin-top: 30px; padding-top: 20px; border-top: 2px solid rgba(255, 255, 255, 0.2);">
                <div class="announcement-actions">
                    <button class="announcement-btn-action btn-close" onclick="this.closest('.announcement-modal').remove()" style="background: rgba(255, 255, 255, 0.2); color: #ffffff; padding: 12px 24px; font-size: 16px;">取消</button>
                    <button class="announcement-btn-action btn" onclick="saveBatchEdit()" style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: #ffffff; padding: 12px 24px; font-size: 16px; font-weight: 600;">保存</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

async function saveBatchEdit() {
    if (!currentEditingBatch) return;
    
    const name = document.getElementById('editBatchName').value.trim();
    const description = document.getElementById('editBatchDescription').value.trim();
    const startDate = document.getElementById('editBatchStartDate').value;
    const endDate = document.getElementById('editBatchEndDate').value;
    const status = document.getElementById('editBatchStatus').value;
    
    if (!name || !startDate || !endDate) {
        alert('请填写批次名称、开始日期和结束日期');
        return;
    }
    
    if (new Date(startDate) >= new Date(endDate)) {
        alert('结束日期必须晚于开始日期！');
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('action', 'updateBatch');
        formData.append('id', currentEditingBatch.id);
        formData.append('name', name);
        formData.append('description', description);
        formData.append('start_date', startDate);
        formData.append('end_date', endDate);
        formData.append('status', status);
        
        const response = await fetch('api/applications.php', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('批次更新成功');
            document.querySelector('.announcement-modal').remove();
            loadBatchesList();
            currentEditingBatch = null;
        } else {
            throw new Error(data.message || '更新失败');
        }
    } catch (error) {
        console.error('Update batch error:', error);
        alert('更新批次失败：' + error.message);
    }
}

async function deleteBatchItem(batchId, batchName) {
    if (!confirm(`确定要删除批次 "${batchName}" 吗？\n注意：如果该批次已有申请，则无法删除。`)) {
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('action', 'deleteBatch');
        formData.append('id', batchId);
        
        const response = await fetch('api/applications.php', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('批次删除成功');
            loadBatchesList();
        } else {
            throw new Error(data.message || '删除失败');
        }
    } catch (error) {
        console.error('Delete batch error:', error);
        alert('删除批次失败：' + error.message);
    }
}

// 为批次表单添加事件监听
document.addEventListener('DOMContentLoaded', function() {
    const batchForm = document.getElementById('batchForm');
    if (batchForm) {
        batchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addBatch();
        });
    }
});

// 编辑申请功能
async function editApplication(applicationId) {
    try {
        // 获取申请详情
        const response = await ApiClient.get(`api/applications.php?action=get_detail&id=${applicationId}`);
        
        if (response.success && response.data) {
            const application = response.data;
            
            // 跳转到申请页面并预填数据
            showApplicationPage(application.batch_id, applicationId);
            
            // 确保按钮状态正确
            setTimeout(() => {
                forceResetSubmitButton();
            }, 1000);
        } else {
            alert('获取申请详情失败：' + (response.message || '未知错误'));
        }
    } catch (error) {
        console.error('Edit application error:', error);
        alert('获取申请详情失败：' + error.message);
    }
}

// 排名功能相关函数
async function initRankingTab() {
    try {
        // 加载批次列表到排名下拉框
        await DataManager.loadBatches();
        const rankingBatchSelect = document.getElementById('rankingBatchSelect');
        if (rankingBatchSelect) {
            rankingBatchSelect.innerHTML = '<option value="">请选择批次</option>';
            
            batches.forEach(batch => {
                const option = document.createElement('option');
                option.value = batch.id;
                option.textContent = batch.name;
                rankingBatchSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Init ranking tab error:', error);
        // 如果加载失败，至少提供一个错误提示
        const rankingBatchSelect = document.getElementById('rankingBatchSelect');
        if (rankingBatchSelect) {
            rankingBatchSelect.innerHTML = '<option value="">加载批次失败</option>';
        }
    }
}

async function loadBatchRanking() {
    const batchSelect = document.getElementById('rankingBatchSelect');
    const batchId = batchSelect.value;
    const tableContainer = document.getElementById('rankingTableContainer');
    const exportBtn = document.getElementById('exportBtn');
    
    if (!batchId) {
        tableContainer.innerHTML = '<p style="text-align: center; color: rgba(255, 255, 255, 0.7);">请选择批次查看排名</p>';
        exportBtn.disabled = true;
        return;
    }
    
    try {
        // 显示加载状态
        tableContainer.innerHTML = '<p style="text-align: center; color: rgba(255, 255, 255, 0.7);">正在加载排名数据...</p>';
        
        const response = await fetch(`api/ranking.php?action=getBatchRanking&batch_id=${batchId}`, {
            method: 'GET',
            credentials: 'same-origin'
        });
        
        const data = await response.json();
        
        if (data.success) {
            renderRankingTable(data.data);
            exportBtn.disabled = false;
        } else {
            throw new Error(data.message || '获取排名数据失败');
        }
    } catch (error) {
        console.error('Load batch ranking error:', error);
        tableContainer.innerHTML = `<p style="text-align: center; color: #ff6b6b;">加载失败: ${error.message}</p>`;
        exportBtn.disabled = true;
    }
}

function renderRankingTable(data) {
    const tableContainer = document.getElementById('rankingTableContainer');
    const { batch, rankings, total_count } = data;
    
    if (rankings.length === 0) {
        tableContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.7);">
                <div style="font-size: 48px; margin-bottom: 20px;">📊</div>
                <h3>暂无排名数据</h3>
                <p>该批次还没有审核通过的申请</p>
            </div>
        `;
        return;
    }
    
    let tableHtml = `
        <div style="margin-bottom: 20px;">
            <h3 style="color: white; margin: 0;">${batch.name} - 奖学金排名</h3>
            <p style="color: rgba(255, 255, 255, 0.7); margin: 5px 0;">共 ${total_count} 人通过审核</p>
        </div>
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; background: rgba(255, 255, 255, 0.1); border-radius: 12px; overflow: hidden;">
                <thead>
                    <tr style="background: rgba(255, 255, 255, 0.2);">
                        <th style="padding: 15px; text-align: center; color: white; border-bottom: 1px solid rgba(255, 255, 255, 0.3);">排名</th>
                        <th style="padding: 15px; text-align: left; color: white; border-bottom: 1px solid rgba(255, 255, 255, 0.3);">姓名</th>
                        <th style="padding: 15px; text-align: left; color: white; border-bottom: 1px solid rgba(255, 255, 255, 0.3);">学号</th>
                        <th style="padding: 15px; text-align: left; color: white; border-bottom: 1px solid rgba(255, 255, 255, 0.3);">班级</th>
                        <th style="padding: 15px; text-align: center; color: white; border-bottom: 1px solid rgba(255, 255, 255, 0.3);">总分</th>
                        <th style="padding: 15px; text-align: center; color: white; border-bottom: 1px solid rgba(255, 255, 255, 0.3);">德育</th>
                        <th style="padding: 15px; text-align: center; color: white; border-bottom: 1px solid rgba(255, 255, 255, 0.3);">能力</th>
                        <th style="padding: 15px; text-align: center; color: white; border-bottom: 1px solid rgba(255, 255, 255, 0.3);">体育</th>
                        <th style="padding: 15px; text-align: center; color: white; border-bottom: 1px solid rgba(255, 255, 255, 0.3);">其他</th>
                        <th style="padding: 15px; text-align: center; color: white; border-bottom: 1px solid rgba(255, 255, 255, 0.3);">审核时间</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    rankings.forEach((ranking, index) => {
        // 计算各类目分数
        const categoryScores = {
            '德育': 0,
            '能力': 0,
            '体育': 0,
            '其他材料': 0
        };
        
        Object.keys(ranking.materials).forEach(categoryName => {
            const materials = ranking.materials[categoryName];
            let categoryScore = 0;
            materials.forEach(material => {
                categoryScore += parseFloat(material.score || 0);
            });
            if (categoryScores.hasOwnProperty(categoryName)) {
                categoryScores[categoryName] = categoryScore;
            }
        });
        
        const rowStyle = index % 2 === 0 ? 'background: rgba(255, 255, 255, 0.05);' : '';
        const rankStyle = ranking.rank <= 3 ? 
            (ranking.rank === 1 ? 'color: #ffd700; font-weight: bold;' : 
             ranking.rank === 2 ? 'color: #c0c0c0; font-weight: bold;' : 
             'color: #cd7f32; font-weight: bold;') : 'color: white;';
        
        tableHtml += `
            <tr style="${rowStyle}">
                <td style="padding: 12px; text-align: center; ${rankStyle} border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                    ${ranking.rank <= 3 ? (ranking.rank === 1 ? '🥇' : ranking.rank === 2 ? '🥈' : '🥉') : ''} ${ranking.rank}
                </td>
                <td style="padding: 12px; color: white; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                    ${ranking.real_name || ranking.username}
                </td>
                <td style="padding: 12px; color: rgba(255, 255, 255, 0.8); border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                    ${ranking.student_id || '-'}
                </td>
                <td style="padding: 12px; color: rgba(255, 255, 255, 0.8); border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                    ${ranking.class || '-'}
                </td>
                <td style="padding: 12px; text-align: center; color: #4ecdc4; font-weight: bold; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                    ${parseFloat(ranking.total_score).toFixed(1)}
                </td>
                <td style="padding: 12px; text-align: center; color: rgba(255, 255, 255, 0.8); border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                    ${categoryScores['德育'].toFixed(1)}
                </td>
                <td style="padding: 12px; text-align: center; color: rgba(255, 255, 255, 0.8); border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                    ${categoryScores['能力'].toFixed(1)}
                </td>
                <td style="padding: 12px; text-align: center; color: rgba(255, 255, 255, 0.8); border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                    ${categoryScores['体育'].toFixed(1)}
                </td>
                <td style="padding: 12px; text-align: center; color: rgba(255, 255, 255, 0.8); border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                    ${categoryScores['其他材料'].toFixed(1)}
                </td>
                <td style="padding: 12px; text-align: center; color: rgba(255, 255, 255, 0.6); font-size: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                    ${new Date(ranking.reviewed_at).toLocaleDateString('zh-CN')}
                </td>
            </tr>
        `;
    });
    
    tableHtml += `
                </tbody>
            </table>
        </div>
    `;
    
    tableContainer.innerHTML = tableHtml;
}

async function exportRankingToExcel() {
    const batchSelect = document.getElementById('rankingBatchSelect');
    const batchId = batchSelect.value;
    
    if (!batchId) {
        alert('请先选择批次');
        return;
    }
    
    try {
        const exportBtn = document.getElementById('exportBtn');
        const originalText = exportBtn.innerHTML;
        exportBtn.innerHTML = '导出中...';
        exportBtn.disabled = true;
        
        const response = await fetch(`api/ranking.php?action=exportExcel&batch_id=${batchId}`, {
            method: 'GET',
            credentials: 'same-origin'
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 创建下载链接
            const downloadUrl = data.data.download_url;
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = data.data.file_name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            alert('导出成功！文件已开始下载。');
        } else {
            throw new Error(data.message || '导出失败');
        }
    } catch (error) {
        console.error('Export ranking error:', error);
        alert('导出失败: ' + error.message);
    } finally {
        const exportBtn = document.getElementById('exportBtn');
        exportBtn.innerHTML = '📥 导出Excel';
        exportBtn.disabled = false;
    }
}

// 密码修改相关功能
function showChangePasswordModal(isForced = false) {
    const modal = document.getElementById('changePasswordModal');
    const currentPasswordGroup = document.getElementById('currentPasswordGroup');
    const currentPasswordInput = document.getElementById('currentPassword');
    const form = document.getElementById('changePasswordForm');
    
    // 如果是首次登录强制修改密码，隐藏当前密码输入框
    if (isForced) {
        currentPasswordGroup.style.display = 'none';
        currentPasswordInput.removeAttribute('required');
        document.querySelector('#changePasswordModal .announcement-title').textContent = '首次登录 - 必须修改密码';
        // 设置不可关闭
        document.querySelector('#changePasswordModal .announcement-close').style.display = 'none';
    } else {
        currentPasswordGroup.style.display = 'block';
        currentPasswordInput.setAttribute('required', 'required');
        document.querySelector('#changePasswordModal .announcement-title').textContent = '修改密码';
        document.querySelector('#changePasswordModal .announcement-close').style.display = 'block';
    }
    
    // 重置表单
    form.reset();
    
    // 显示弹窗
    modal.classList.remove('hidden');
    
    // 添加表单提交事件处理
    form.onsubmit = async function(e) {
        e.preventDefault();
        await handleChangePassword(isForced);
    };
}

function closeChangePasswordModal() {
    const modal = document.getElementById('changePasswordModal');
    modal.classList.add('hidden');
    document.getElementById('changePasswordForm').reset();
}

async function handleChangePassword(isForced = false) {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const submitBtn = document.querySelector('#changePasswordForm button[type="submit"]');
    
    // 验证新密码
    if (newPassword.length < 6) {
        alert('新密码长度不能少于6位');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        alert('两次输入的密码不一致');
        return;
    }
    
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '修改中...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('api/users.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                action: 'change_password',
                current_password: currentPassword,
                new_password: newPassword,
                confirm_password: confirmPassword
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('密码修改成功');
            closeChangePasswordModal();
            
            // 如果是强制修改密码，刷新页面重新登录检查
            if (isForced) {
                location.reload();
            }
        } else {
            throw new Error(data.message || '密码修改失败');
        }
    } catch (error) {
        console.error('Change password error:', error);
        alert('密码修改失败: ' + error.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// 检查是否需要强制修改密码
function checkForcePasswordChange(user) {
    if (user.first_login && user.type === 'student') {
        // 延迟显示，确保页面已经加载完成
        setTimeout(() => {
            alert('检测到您是首次登录，为了账户安全，请修改您的初始密码！');
            showChangePasswordModal(true);
        }, 1000);
        return true;
    }
    return false;
}
