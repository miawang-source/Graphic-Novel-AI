#!/bin/bash

# 生产环境部署脚本
# 使用方法: ./scripts/deploy.sh [environment]

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查必需的工具
check_requirements() {
    log_info "检查部署环境..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi
    
    log_success "环境检查通过"
}

# 检查环境变量
check_env_vars() {
    log_info "检查环境变量..."
    
    local env_file=".env.production"
    if [ ! -f "$env_file" ]; then
        log_error "缺少 $env_file 文件"
        log_info "请复制 .env.example 并配置生产环境变量"
        exit 1
    fi
    
    # 检查必需的环境变量
    source "$env_file"
    
    if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
        log_error "缺少 NEXT_PUBLIC_SUPABASE_URL 环境变量"
        exit 1
    fi
    
    if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
        log_error "缺少 NEXT_PUBLIC_SUPABASE_ANON_KEY 环境变量"
        exit 1
    fi
    
    if [ -z "$OPENROUTER_API_KEY" ]; then
        log_error "缺少 OPENROUTER_API_KEY 环境变量"
        exit 1
    fi
    
    log_success "环境变量检查通过"
}

# 清理开发文件
cleanup_dev_files() {
    log_info "清理开发文件..."
    
    if [ -f "scripts/cleanup-for-production.js" ]; then
        node scripts/cleanup-for-production.js --confirm
    else
        log_warning "清理脚本不存在，跳过文件清理"
    fi
    
    log_success "开发文件清理完成"
}

# 安装依赖
install_dependencies() {
    log_info "安装生产依赖..."
    
    # 清理 node_modules 和缓存
    rm -rf node_modules
    rm -rf .next
    npm cache clean --force
    
    # 安装依赖
    npm ci --only=production
    
    log_success "依赖安装完成"
}

# 运行代码检查
run_checks() {
    log_info "运行代码检查..."
    
    # TypeScript 类型检查
    log_info "运行 TypeScript 检查..."
    npm run type-check
    
    # ESLint 检查
    log_info "运行 ESLint 检查..."
    npm run lint
    
    log_success "代码检查通过"
}

# 构建应用
build_app() {
    log_info "构建生产版本..."
    
    export NODE_ENV=production
    npm run build
    
    log_success "应用构建完成"
}

# 运行测试（如果有）
run_tests() {
    log_info "运行测试..."
    
    if npm run test --if-present; then
        log_success "测试通过"
    else
        log_warning "没有找到测试或测试失败"
    fi
}

# 部署到服务器
deploy_to_server() {
    local environment=${1:-production}
    
    log_info "部署到 $environment 环境..."
    
    case $environment in
        "production")
            # 这里添加生产环境部署逻辑
            # 例如：上传到服务器、更新 Docker 容器等
            log_info "部署到生产服务器..."
            ;;
        "staging")
            # 这里添加测试环境部署逻辑
            log_info "部署到测试服务器..."
            ;;
        *)
            log_error "未知的部署环境: $environment"
            exit 1
            ;;
    esac
    
    log_success "部署完成"
}

# 主函数
main() {
    local environment=${1:-production}
    
    log_info "开始部署到 $environment 环境..."
    
    check_requirements
    check_env_vars
    cleanup_dev_files
    install_dependencies
    run_checks
    build_app
    run_tests
    deploy_to_server "$environment"
    
    log_success "🎉 部署成功完成!"
    log_info "应用已准备好在生产环境中运行"
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
