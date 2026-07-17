import type { ProjectTemplate } from "./onboarding.types";

export const USAGE_PURPOSES = [
  { value: "work", label: "Công việc cá nhân" },
  { value: "freelance", label: "Dự án freelance" },
  { value: "study", label: "Học tập" },
  { value: "side_project", label: "Dự án cá nhân (side project)" },
  { value: "life", label: "Quản lý cuộc sống hằng ngày" },
] as const;

export const INDUSTRIES = [
  { value: "retail", label: "Bán lẻ / Thương mại" },
  { value: "manufacturing", label: "Sản xuất" },
  { value: "technology", label: "Công nghệ thông tin" },
  { value: "construction", label: "Xây dựng" },
  { value: "logistics", label: "Vận tải / Logistics" },
  { value: "fnb", label: "Nhà hàng / Ăn uống" },
  { value: "education", label: "Giáo dục / Đào tạo" },
  { value: "healthcare", label: "Y tế / Sức khỏe" },
  { value: "finance", label: "Tài chính / Kế toán" },
  { value: "services", label: "Dịch vụ khác" },
] as const;

export const COMPANY_SIZES = [
  { value: "1-5", label: "1 - 5 người" },
  { value: "6-20", label: "6 - 20 người" },
  { value: "21-50", label: "21 - 50 người" },
  { value: "51-100", label: "51 - 100 người" },
  { value: "100+", label: "Trên 100 người" },
] as const;

export const TIMEZONES = [
  { value: "Asia/Ho_Chi_Minh", label: "Việt Nam (GMT+7)" },
  { value: "Asia/Bangkok", label: "Bangkok (GMT+7)" },
  { value: "Asia/Singapore", label: "Singapore (GMT+8)" },
  { value: "Asia/Tokyo", label: "Tokyo (GMT+9)" },
  { value: "UTC", label: "UTC (GMT+0)" },
] as const;

export const LOCALES = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
] as const;

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    key: "blank",
    name: "Bắt đầu trống",
    description: "Tự tạo dự án và công việc theo cách của bạn.",
    projectName: "",
    taskTitles: [],
  },
  {
    key: "kanban_basic",
    name: "Quản lý công việc cơ bản",
    description: "Dự án mẫu với các công việc khởi đầu đơn giản.",
    projectName: "Công việc của tôi",
    taskTitles: [
      "Lên danh sách việc cần làm tuần này",
      "Sắp xếp thứ tự ưu tiên",
      "Hoàn thành việc quan trọng nhất",
    ],
  },
  {
    key: "team_sprint",
    name: "Dự án nhóm theo sprint",
    description: "Khung dự án cho nhóm làm việc theo chu kỳ 2 tuần.",
    projectName: "Sprint đầu tiên",
    taskTitles: [
      "Họp lập kế hoạch sprint",
      "Phân công công việc cho thành viên",
      "Chuẩn bị báo cáo tiến độ",
      "Họp tổng kết sprint",
    ],
  },
  {
    key: "sme_operations",
    name: "Vận hành doanh nghiệp SME",
    description: "Các đầu việc vận hành thường gặp của doanh nghiệp nhỏ.",
    projectName: "Vận hành công ty",
    taskTitles: [
      "Chuẩn hóa quy trình bán hàng",
      "Theo dõi công nợ khách hàng",
      "Lập kế hoạch nhân sự quý",
    ],
  },
];

export const MODULE_LABELS: Record<
  string,
  { name: string; description: string }
> = {
  tasks: { name: "Công việc", description: "Tạo và theo dõi công việc" },
  projects: { name: "Dự án", description: "Tổ chức công việc theo dự án" },
  members: { name: "Thành viên", description: "Mời và quản lý đồng nghiệp" },
  calendar: { name: "Lịch", description: "Xem lịch và hạn hoàn thành" },
  files: { name: "Tệp tin", description: "Đính kèm và quản lý tệp" },
  reports: { name: "Báo cáo", description: "Báo cáo tiến độ và khối lượng" },
};

export const ROLE_LABELS: Record<string, string> = {
  owner: "Chủ sở hữu",
  admin: "Quản trị viên",
  manager: "Quản lý",
  member: "Thành viên",
};

export const STEP_TITLES: Record<string, string> = {
  workspace_name: "Đặt tên không gian làm việc",
  usage_purpose: "Mục đích sử dụng",
  workspace_profile: "Thông tin tổ chức",
  template: "Chọn mẫu khởi đầu",
  modules: "Chọn tính năng",
  first_project: "Dự án đầu tiên",
  invite_team: "Mời đồng nghiệp",
  welcome: "Chào mừng",
  profile: "Hồ sơ cá nhân",
  role_intro: "Vai trò của bạn",
  complete: "Hoàn tất",
};
