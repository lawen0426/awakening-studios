import html2canvas from 'html2canvas'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import { inviteWorkspaceMember, listWorkspaceMembers, loadCloudWorkspace, removeWorkspaceMember, saveCloudWorkspace, updateWorkspaceMemberRole } from './lib/cloudWorkspace'
import type { WorkspaceMemberRecord } from './lib/cloudWorkspace'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type Language = 'en' | 'zh'
type ViewMode = 'list' | 'gantt'
type GanttTimeMode = 'planned' | 'actual' | 'delta'

type WeekPlan = {
  id: string
  stageId: string
  days: number
  planned: string
  actual: string
  notes: string
}

type StagePlanningMode = 'timed' | 'schedule-only'
type StageColorKey =
  | 'mist'
  | 'mint'
  | 'sage'
  | 'moss'
  | 'teal'
  | 'sky'
  | 'gold'
  | 'amber'
  | 'orange'
  | 'copper'
  | 'red'
  | 'wine'

type StageTemplate = {
  id: string
  name: string
  efficiency: number
  planningMode?: StagePlanningMode
  colorKey?: StageColorKey
  isDefault?: boolean
}

type ScheduleMode = 'week-driven' | 'date-driven'

type Project = {
  id: string
  name: string
  description: string
  scoreDuration: string
  startDate: string
  endDate: string
  endDateMode: 'auto' | 'manual'
  scheduleMode: ScheduleMode
  stages: StageTemplate[]
  weeks: WeekPlan[]
}

type WorkspaceState = {
  projects: Project[]
  activeProjectId: string
}

type StagePopupPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
}

type StageEditorState = {
  mode: 'create' | 'edit'
  sourceWeekId: string | null
  stageId: string | null
  name: string
  efficiency: string
  planningMode: StagePlanningMode
  colorKey: StageColorKey
}

type ProjectEditorState = {
  mode: 'create' | 'edit'
  projectId: string | null
  name: string
}

type ImportConflictState = {
  existingProjectId: string
  importedProject: Project
}

type LegacyWeekPlan = Omit<WeekPlan, 'actual' | 'stageId'> & {
  stage?: string
  actual?: string
  actualMinutes?: string
  actualSeconds?: string
}

type LegacyProjectState = {
  movieTitle?: string
  totalWeeks?: number
  stages?: StageTemplate[]
  weeks?: Array<WeekPlan | LegacyWeekPlan>
}

type Copy = (typeof copy)[Language]

const STORAGE_KEY = 'weekly-score-planner-workspace'
const LEGACY_STORAGE_KEY = 'weekly-score-planner-state'
const LANGUAGE_STORAGE_KEY = 'weekly-score-planner-language'
const AUTH_STORAGE_KEY = 'weekly-score-planner-auth'
const DEFAULT_BASELINE_WEEKLY_TARGET = '0:13:17'
const DEFAULT_TOTAL_DURATION = ''
const DAY_MS = 24 * 60 * 60 * 1000
const GANTT_HORIZONTAL_ZOOMS = [10, 14, 18, 24, 32] as const
const GANTT_VERTICAL_ZOOMS = [32, 44, 56, 68, 82, 98] as const

const copy = {
  en: {
    heroTitle: 'Film Scoring Weekly Planner',
    heroCopy: 'Track stages, dates, workload, and weekly execution in one place.',
    menu: 'Menu',
    menuTitle: 'Actions',
    closeMenu: 'Close menu',
    language: 'Language',
    resetDefault: 'Reset to Default',
    resetConfirm: 'Current content will be lost. Reset this project to default settings?',
    exportLibrary: 'Export All Projects (.json)',
    importLibrary: 'Import All Projects (.json)',
    libraryExportName: 'planner-library',
    importLibraryConfirm: 'Replace the current library with the imported file? This will overwrite all current projects.',
    invalidLibrary: 'This library file is not supported.',
    exportCsv: 'Export Project (.csv)',
    exportImage: 'Export Image',
    exportingImage: 'Exporting Image...',
    importCsv: 'Import Project (.csv)',
    projects: 'Projects',
    projectName: 'Project Note',
    projectDescription: 'Project Description',
    scoreDuration: 'Total Duration',
    editable: 'Editable',
    newProject: 'New Project',
    addNewProject: '+ Add New Project',
    editProject: 'Edit Project',
    closeProjectEditor: 'Close project editor',
    editProjectAria: 'Edit',
    deleteProjectAria: 'Delete',
    moveWeekUpAria: 'Move week up',
    moveWeekDownAria: 'Move week down',
    deleteProjectConfirm: 'Delete this project? This cannot be undone.',
    closeImportConflict: 'Close import conflict',
    importConflictTitle: 'Import Conflict',
    importConflictBody: 'A similar project already exists. You can overwrite it or keep both.',
    scheduleModeLabel: 'Schedule Mode',
    scheduleModeWeek: 'By Week',
    scheduleModeDate: 'By Date',
    scheduleModeHelp: 'Switch to Week-driven to add or remove weeks.',
    overwriteProject: 'Overwrite',
    keepBothProjects: 'Keep Both',
    untitledProject: 'Untitled Project',
    switchProject: 'Switch Project',
    projectPlaceholder: 'Select a project',
    weeklyPlan: 'Weekly Plan',
    weeklyPlanKicker: 'Weekly Plan',
    weekRange: 'Range',
    index: 'Week',
    stage: 'Stage',
    days: 'Days',
    planned: 'Planned',
    actual: 'Actual',
    delta: 'Delta',
    notes: 'Notes',
    addNewStage: '+ Add New Stage',
    addWeek: 'Add Week',
    startDate: 'Start Date',
    endDate: 'End Date',
    summary: 'Summary',
    totalWeeks: 'Total Weeks',
    totalDays: 'Total Days',
    currentDays: 'Current Days',
    targetWeeks: 'Target Weeks',
    targetDays: 'Target Days',
    totalPlanned: 'Total Planned',
    totalActual: 'Written Time',
    writtenShort: 'Written',
    averagePerWeek: 'Average / Week',
    perWeek: 'Per Week',
    totalDelta: 'Writing Delta',
    totalMinsLeft: 'Total Minutes Left',
    timeLeft: 'Time Left',
    writingTimeLeft: 'Writing Time Left',
    timeLabel: 'Time',
    writingSummary: 'Writing Summary',
    scheduleSummary: 'Schedule Summary',
    breakdownTitle: 'Breakdown',
    writingLabel: 'Writing',
    scheduledLabel: 'Scheduled',
    writingWeeks: 'Writing Weeks',
    scheduleWeeks: 'Schedule Weeks',
    writingWeeksLeft: 'Writing Weeks Left',
    writingDays: 'Writing Days',
    scheduleDays: 'Schedule Days',
    scheduleDaysLeft: 'Schedule Days Left',
    calendarWeeks: 'Calendar Weeks',
    calendarWeeksLeft: 'Total Weeks Left',
    currentWeek: 'Current Week',
    weekShort: 'Week',
    leftShort: 'Left',
    daysLeft: 'Total Days Left',
    daysLeftCompact: 'Days',
    writingDaysLeft: 'Writing Days Left',
    weeksLeft: 'Weeks Left',
    averagePerDay: 'Average / Day',
    perDay: 'Per Day',
    actualMinusPlanned: 'Actual - Planned',
    addStage: 'Add Stage',
    editStage: 'Edit Stage',
    closeStageEditor: 'Close stage editor',
    stageName: 'Stage Name',
    efficiency: 'Efficiency',
    stageType: 'Stage Type',
    stageColor: 'Stage Color',
    stageTypeTimed: 'Writing Weeks',
    stageTypeScheduleOnly: 'Schedule Weeks',
    stageTypeTimedHelp: 'Uses planned and actual duration in scoring totals.',
    stageTypeScheduleOnlyHelp: 'Shows the work on the calendar, but does not use duration calculations.',
    nonTimedWeekLabel: 'Sched.',
    timeFormatInvalid: 'Use mm:ss format. Seconds must be 00-59.',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    moveWeekUp: 'Move Up',
    moveWeekDown: 'Move Down',
    deleteConfirm: 'Deleting this week will change totals and summary data. Continue?',
    deleteStageConfirm: 'Delete this stage? Weeks using it will be reassigned.',
    deleteLastStageAlert: 'At least one stage must remain.',
    editStageAria: 'Edit',
    deleteStageAria: 'Delete',
    stageNeedsAssignment: 'Needs Stage',
    stageNeedsAssignmentHelp: 'This week has no stage assigned yet. Pick a stage to restore automatic planning.',
    summaryStageWarning: 'Some weeks are missing a stage. Automatic stage-based planning is paused for those weeks until you assign one.',
    untitledStage: 'Untitled Stage',
    newStage: 'New Stage',
    invalidCsv: 'This CSV file is not supported.',
    importSuccess: 'Project imported.',
    scheduleMismatch: 'Date range and table do not match yet. Please adjust weeks and days manually.',
    warningWeeksMismatch: 'The date range calculates a different total week count than the current weekly table.',
    warningDaysMismatch: 'The date range calculates a different total day count than the current weekly table.',
    warningOverflowWeek: 'This week is outside the current date range and needs review.',
    listView: 'List',
    ganttView: 'Gantt',
    ganttTitle: 'Project Gantt',
    ganttCopy: 'See every project on one shared timeline.',
    ganttUnscheduled: 'Set start and end dates to place this project on the Gantt view.',
    ganttNoProjects: 'No scheduled projects yet.',
    ganttWriting: 'Writing Weeks',
    ganttSchedule: 'Schedule Weeks',
    ganttHorizontalZoom: 'Horizontal Zoom',
    ganttVerticalZoom: 'Vertical Zoom',
    ganttZoom: 'Zoom',
    ganttPlannedShort: 'Plan',
    ganttActualShort: 'Actual',
    ganttDeltaShort: 'Delta',
    summaryHide: 'Collapse Summary',
    summaryShow: 'Expand Summary',
    coreStatusTitle: 'Core Status',
    durationTitle: 'Total Duration',
    progressTitle: 'Writing Progress',
    pacingTitle: 'Pacing',
    authTitle: 'Sign In',
    authCopy: 'Use your account to open the planner on this Mac and sync your library.',
    authEmail: 'Email',
    authPassword: 'Password',
    authRemember: 'Remember Me',
    authSignIn: 'Sign In',
    authSignUp: 'Create Account',
    authSignOut: 'Sign Out',
    authLoading: 'Loading account...',
    authSetupTitle: 'Supabase Setup Needed',
    authSetupCopy: 'Add your Supabase anon key in .env.local before cloud sync can work.',
    authConfirmTitle: 'Check Your Email',
    authConfirmCopy: 'Your account has been created. Finish the email confirmation first, then come back here to sign in.',
    authConfirmBack: 'Back to Sign In',
    authConfirmUseAnother: 'Use Another Email',
    menuAccount: 'Account',
    menuTeam: 'Team Sync',
    menuImport: 'Import',
    menuExport: 'Export',
    manageTeam: 'Manage Team',
    menuLibrary: 'Import / Export',
    menuDanger: 'Danger Zone',
    authLoggedInAs: 'Signed in as',
    authSyncing: 'Syncing...',
    authSynced: 'Synced',
    authSyncError: 'Sync error',
    authCheckEmail: 'Account created. Check your email if confirmation is enabled.',
    workspaceLabel: 'Workspace',
    workspaceRole: 'Role',
    workspaceRoleOwner: 'Owner',
    workspaceRoleEditor: 'Editor',
    workspaceRoleViewer: 'Viewer',
    workspaceInvite: 'Invite teammate',
    workspaceInvitePlaceholder: 'teammate@email.com',
    workspaceInviteButton: 'Send Invite',
    workspaceInviteHelp: 'They can sign in with this email to join the same shared workspace.',
    workspaceInviteSent: 'Invite saved. Ask them to sign in with this email.',
    workspaceOwnerOnly: 'Only workspace owners can invite teammates.',
    workspaceMembersTitle: 'Members',
    workspaceRefreshMembers: 'Refresh',
    workspaceMemberPending: 'Pending',
    workspaceMemberActive: 'Joined',
    workspaceRemoveMember: 'Remove',
    workspaceNoMembers: 'No teammates yet.',
    workspaceRoleChange: 'Role',
    workspaceManageTitle: 'Team Management',
    workspaceManageCopy: 'Invite teammates, review pending members, and change access roles here.',
  },
  zh: {
    heroTitle: '电影配乐周计划',
    heroCopy: '把阶段、日期、工作量和每周执行情况放在同一个地方。',
    menu: '菜单',
    menuTitle: '操作',
    closeMenu: '关闭菜单',
    language: '语言',
    resetDefault: '回到默认选项',
    resetConfirm: '点了以后，现在内容会丢失。确认把当前项目恢复为默认吗？',
    exportLibrary: '导出全部项目（.json）',
    importLibrary: '导入全部项目（.json）',
    libraryExportName: '周计划资料库',
    importLibraryConfirm: '要用导入文件替换当前资料库吗？这会覆盖当前所有项目。',
    invalidLibrary: '这个资料库文件暂不支持导入。',
    exportCsv: '导出项目（.csv）',
    exportImage: '导出图片',
    exportingImage: '正在导出图片...',
    importCsv: '导入项目（.csv）',
    projects: '项目',
    projectName: '项目备注',
    projectDescription: '项目描述',
    scoreDuration: '总时长',
    editable: '可编辑',
    newProject: '新增项目',
    addNewProject: '+ 添加新项目',
    editProject: '编辑项目',
    closeProjectEditor: '关闭项目编辑窗口',
    editProjectAria: '编辑',
    deleteProjectAria: '删除',
    moveWeekUpAria: '上移这一周',
    moveWeekDownAria: '下移这一周',
    deleteProjectConfirm: '确认删除这个项目吗？删除后无法恢复。',
    closeImportConflict: '关闭导入冲突窗口',
    importConflictTitle: '导入冲突',
    importConflictBody: '发现一个相似项目。你可以选择覆盖，或者保留两个项目。',
    scheduleModeLabel: '计划模式',
    scheduleModeWeek: '周数驱动',
    scheduleModeDate: '日期驱动',
    scheduleModeHelp: '切换到周数驱动后才可以增删周。',
    overwriteProject: '覆盖',
    keepBothProjects: '保留两个',
    untitledProject: '未命名项目',
    switchProject: '切换项目',
    projectPlaceholder: '选择项目',
    weeklyPlan: '周计划表',
    weeklyPlanKicker: '周计划',
    weekRange: '日期',
    index: '周次',
    stage: '阶段',
    days: '天数',
    planned: '计划时长',
    actual: '实际时长',
    delta: '差值',
    notes: '备注',
    addNewStage: '+ 添加新阶段',
    addWeek: '新增一周',
    startDate: '开始日期',
    endDate: '结束日期',
    summary: '汇总计算',
    totalWeeks: '总周数',
    totalDays: '总天数',
    currentDays: '当前天数',
    targetWeeks: '目标周数',
    targetDays: '目标天数',
    totalPlanned: '总计划时长',
    totalActual: '已写时长',
    writtenShort: '已写',
    averagePerWeek: '平均每周',
    perWeek: '每周',
    totalDelta: '写作差值',
    totalMinsLeft: '剩余时长',
    timeLeft: '剩余时长',
    writingTimeLeft: '写作剩余时长',
    timeLabel: '时长',
    writingSummary: '写作统计',
    scheduleSummary: '排期统计',
    breakdownTitle: '拆分',
    writingLabel: '写作',
    scheduledLabel: '排期',
    writingWeeks: '写作周数',
    scheduleWeeks: '排期周数',
    writingWeeksLeft: '写作剩余周数',
    writingDays: '写作天数',
    scheduleDays: '排期天数',
    scheduleDaysLeft: '排期剩余天数',
    calendarWeeks: '排期总周数',
    calendarWeeksLeft: '总周数剩余',
    currentWeek: '当前周数',
    weekShort: '周次',
    leftShort: '剩余',
    daysLeft: '总天数剩余',
    daysLeftCompact: '天数',
    writingDaysLeft: '写作剩余天数',
    weeksLeft: '剩余周数',
    averagePerDay: '平均每天',
    perDay: '每天',
    actualMinusPlanned: '实际 - 计划',
    addStage: '添加阶段',
    editStage: '编辑阶段',
    closeStageEditor: '关闭阶段编辑窗口',
    stageName: '阶段名称',
    efficiency: '效率系数',
    stageType: '阶段类型',
    stageColor: '阶段颜色',
    stageTypeTimed: '写作周',
    stageTypeScheduleOnly: '排期周',
    stageTypeTimedHelp: '使用计划和实际时长，并参与配乐总时长计算。',
    stageTypeScheduleOnlyHelp: '显示在周计划和日期里，但不参与时长计算。',
    nonTimedWeekLabel: '仅排期',
    timeFormatInvalid: '请输入 mm:ss 格式，秒数必须在 00-59。',
    cancel: '取消',
    save: '保存',
    delete: '删除',
    moveWeekUp: '上移',
    moveWeekDown: '下移',
    deleteConfirm: '删除这一周会影响总周数和汇总计算，确认继续删除吗？',
    deleteStageConfirm: '确认删除这个阶段吗？使用这个阶段的周会自动改到其他阶段。',
    deleteLastStageAlert: '至少需要保留一个阶段。',
    editStageAria: '编辑',
    deleteStageAria: '删除',
    stageNeedsAssignment: '待分配',
    stageNeedsAssignmentHelp: '这一周还没有分配阶段。重新选择一个阶段后，自动计划分配才会恢复。',
    summaryStageWarning: '有些周还没有分配阶段。在你重新指定阶段之前，这些周不会参与按阶段的自动计划分配。',
    untitledStage: '未命名阶段',
    newStage: '新阶段',
    invalidCsv: '这个 CSV 文件暂不支持导入。',
    importSuccess: '项目已导入。',
    scheduleMismatch: '日期范围和表格还不一致，请手动调整周数和天数。',
    warningWeeksMismatch: '日期范围推导出的总周数，与当前周计划表里的周数不一致。',
    warningDaysMismatch: '日期范围推导出的总天数，与当前周计划表里的天数不一致。',
    warningOverflowWeek: '这一周已经超出当前日期范围，需要检查或调整。',
    listView: 'List',
    ganttView: 'Gantt',
    ganttTitle: '项目甘特图',
    ganttCopy: '把所有项目放到同一条时间轴上查看。',
    ganttUnscheduled: '设置开始和结束日期后，这个项目才会出现在甘特图里。',
    ganttNoProjects: '还没有可显示排期的项目。',
    ganttWriting: '写作周',
    ganttSchedule: '排期周',
    ganttHorizontalZoom: '横向缩放',
    ganttVerticalZoom: '纵向缩放',
    ganttZoom: '缩放',
    ganttPlannedShort: '计划',
    ganttActualShort: '实际',
    ganttDeltaShort: '差值',
    summaryHide: '收起汇总',
    summaryShow: '展开汇总',
    coreStatusTitle: '核心状态',
    durationTitle: '总时长',
    progressTitle: '写作进度',
    pacingTitle: '节奏',
    authTitle: '登录',
    authCopy: '登录后就可以在这台 Mac 上打开项目，并把资料同步到云端。',
    authEmail: '邮箱',
    authPassword: '密码',
    authRemember: '记住密码',
    authSignIn: '登录',
    authSignUp: '创建账号',
    authSignOut: '退出登录',
    authLoading: '正在加载账号...',
    authSetupTitle: '需要配置 Supabase',
    authSetupCopy: '先把 Supabase 的 anon key 填到 .env.local，云同步才会工作。',
    authConfirmTitle: '请先确认邮箱',
    authConfirmCopy: '账号已经创建成功。先去邮箱完成确认，再回来登录就可以了。',
    authConfirmBack: '返回登录',
    authConfirmUseAnother: '换一个邮箱',
    menuAccount: '账号',
    menuTeam: '团队同步',
    menuImport: '导入',
    menuExport: '导出',
    manageTeam: '管理团队',
    menuLibrary: '导入 / 导出',
    menuDanger: '危险操作',
    authLoggedInAs: '当前账号',
    authSyncing: '同步中...',
    authSynced: '已同步',
    authSyncError: '同步失败',
    authCheckEmail: '账号已创建。如果你开启了邮箱确认，请先去邮箱完成验证。',
    workspaceLabel: '共享空间',
    workspaceRole: '权限',
    workspaceRoleOwner: '所有者',
    workspaceRoleEditor: '可编辑',
    workspaceRoleViewer: '只读',
    workspaceInvite: '邀请成员',
    workspaceInvitePlaceholder: '队友邮箱',
    workspaceInviteButton: '发送邀请',
    workspaceInviteHelp: '对方用这个邮箱登录后，就会加入同一个共享空间。',
    workspaceInviteSent: '邀请已保存，让对方用这个邮箱登录即可。',
    workspaceOwnerOnly: '只有共享空间所有者可以邀请成员。',
    workspaceMembersTitle: '成员',
    workspaceRefreshMembers: '刷新',
    workspaceMemberPending: '待接受',
    workspaceMemberActive: '已加入',
    workspaceRemoveMember: '移除',
    workspaceNoMembers: '还没有团队成员。',
    workspaceRoleChange: '角色',
    workspaceManageTitle: '团队管理',
    workspaceManageCopy: '在这里邀请成员、查看待接受状态，并调整每个人的访问权限。',
  },
} as const

const defaultStageLabels = {
  en: {
    start: 'Start',
    theme: 'Theme',
    efficient: 'Efficiency',
    complex: 'Complex',
    sprint: 'Sprint',
    buffer: 'Buffer',
    wrap: 'Wrap',
  },
  zh: {
    start: '启动',
    theme: '主题',
    efficient: '效率',
    complex: '复杂',
    sprint: '冲刺',
    buffer: '缓冲',
    wrap: '收尾',
  },
} as const

const defaultStageBlueprints = [
  { id: 'start', efficiency: 0.4, colorKey: 'mist' },
  { id: 'theme', efficiency: 0.8, colorKey: 'teal' },
  { id: 'efficient', efficiency: 1.2, colorKey: 'orange' },
  { id: 'complex', efficiency: 0.8, colorKey: 'amber' },
  { id: 'sprint', efficiency: 1.4, colorKey: 'red' },
  { id: 'buffer', efficiency: 0.8, colorKey: 'sage' },
  { id: 'wrap', efficiency: 0.4, colorKey: 'mist' },
] as const

const stageColorOrder: StageColorKey[] = [
  'mist',
  'mint',
  'sage',
  'moss',
  'teal',
  'sky',
  'gold',
  'amber',
  'orange',
  'copper',
  'red',
  'wine',
]

const stageColorMeta: Record<
  StageColorKey,
  {
    label: { en: string; zh: string }
    chipBackground: string
    chipBorder: string
    chipText: string
    segmentStart: string
    segmentEnd: string
  }
> = {
  mist: {
    label: { en: 'Mist', zh: '雾绿' },
    chipBackground: 'rgba(170, 198, 171, 0.16)',
    chipBorder: 'rgba(191, 219, 192, 0.34)',
    chipText: '#f3fbf4',
    segmentStart: '#b4d2b5',
    segmentEnd: '#729775',
  },
  mint: {
    label: { en: 'Fresh', zh: '浅绿' },
    chipBackground: 'rgba(104, 173, 116, 0.18)',
    chipBorder: 'rgba(115, 190, 126, 0.42)',
    chipText: '#e9f7eb',
    segmentStart: '#78bf83',
    segmentEnd: '#4e8658',
  },
  sage: {
    label: { en: 'Soft', zh: '柔绿' },
    chipBackground: 'rgba(122, 162, 110, 0.18)',
    chipBorder: 'rgba(139, 184, 127, 0.4)',
    chipText: '#edf6ea',
    segmentStart: '#8bb87f',
    segmentEnd: '#5d8058',
  },
  moss: {
    label: { en: 'Moss', zh: '苔绿' },
    chipBackground: 'rgba(94, 133, 88, 0.18)',
    chipBorder: 'rgba(116, 160, 108, 0.4)',
    chipText: '#eff8ea',
    segmentStart: '#76a86c',
    segmentEnd: '#446041',
  },
  teal: {
    label: { en: 'Theme', zh: '青绿' },
    chipBackground: 'rgba(73, 161, 146, 0.18)',
    chipBorder: 'rgba(90, 186, 169, 0.42)',
    chipText: '#e7fbf6',
    segmentStart: '#61b6a5',
    segmentEnd: '#2e7e73',
  },
  sky: {
    label: { en: 'Sky', zh: '灰蓝' },
    chipBackground: 'rgba(102, 142, 163, 0.18)',
    chipBorder: 'rgba(126, 170, 194, 0.38)',
    chipText: '#edf6fb',
    segmentStart: '#80a8bd',
    segmentEnd: '#45667b',
  },
  gold: {
    label: { en: 'Schedule', zh: '金色' },
    chipBackground: 'rgba(190, 165, 97, 0.18)',
    chipBorder: 'rgba(208, 184, 114, 0.42)',
    chipText: '#fff8e3',
    segmentStart: '#ceb66e',
    segmentEnd: '#806627',
  },
  amber: {
    label: { en: 'Warm', zh: '琥珀' },
    chipBackground: 'rgba(196, 146, 61, 0.18)',
    chipBorder: 'rgba(222, 171, 83, 0.42)',
    chipText: '#fff4de',
    segmentStart: '#d5a458',
    segmentEnd: '#8b6223',
  },
  orange: {
    label: { en: 'Drive', zh: '橙色' },
    chipBackground: 'rgba(205, 108, 67, 0.18)',
    chipBorder: 'rgba(230, 126, 80, 0.42)',
    chipText: '#fff0ea',
    segmentStart: '#de8358',
    segmentEnd: '#9f4329',
  },
  copper: {
    label: { en: 'Copper', zh: '铜橙' },
    chipBackground: 'rgba(170, 84, 53, 0.18)',
    chipBorder: 'rgba(196, 104, 71, 0.42)',
    chipText: '#fff0ea',
    segmentStart: '#c86f49',
    segmentEnd: '#7e3423',
  },
  red: {
    label: { en: 'Sprint', zh: '深红' },
    chipBackground: 'rgba(214, 95, 85, 0.18)',
    chipBorder: 'rgba(214, 95, 85, 0.42)',
    chipText: '#fff0ee',
    segmentStart: '#d65f55',
    segmentEnd: '#8f2c27',
  },
  wine: {
    label: { en: 'Wine', zh: '酒红' },
    chipBackground: 'rgba(128, 49, 65, 0.2)',
    chipBorder: 'rgba(155, 68, 88, 0.42)',
    chipText: '#fff1f4',
    segmentStart: '#ad5d73',
    segmentEnd: '#5a2030',
  },
}

const defaultWeekStageSequence = [
  'start',
  'theme',
  'efficient',
  'complex',
  'sprint',
  'buffer',
  'sprint',
  'wrap',
] as const

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function sanitizeFileName(value: string) {
  const trimmed = value.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, '').replace(/\s+/g, '-')
  return trimmed || 'project'
}

function getDefaultStages(language: Language): StageTemplate[] {
  return defaultStageBlueprints.map((stage) => ({
    id: stage.id,
    name: defaultStageLabels[language][stage.id],
    efficiency: stage.efficiency,
    planningMode: 'timed',
    colorKey: stage.colorKey,
    isDefault: true,
  }))
}

function getDefaultWeekStageId(index: number, stages: StageTemplate[]) {
  const preferredStageId = defaultWeekStageSequence[index]
  if (preferredStageId && findStage(stages, preferredStageId)) {
    return preferredStageId
  }

  return ''
}

function createWeek(index: number): WeekPlan {
  return {
    id: createId(`week-${index + 1}`),
    stageId: '',
    days: 5,
    planned: '',
    actual: '',
    notes: '',
  }
}

function createDefaultProject(language: Language): Project {
  const stages = getDefaultStages(language)
  return {
    id: createId('project'),
    name: '',
    description: '',
    scoreDuration: DEFAULT_TOTAL_DURATION,
    startDate: '',
    endDate: '',
    endDateMode: 'auto',
    scheduleMode: 'week-driven',
    stages,
    weeks: Array.from({ length: 8 }, (_, index) => ({
      ...createWeek(index),
      stageId: getDefaultWeekStageId(index, stages),
      planned: '',
    })),
  }
}

function isProjectMetadataBlank(project: Pick<Project, 'name' | 'description' | 'startDate' | 'endDate'>) {
  return !project.name.trim() && !project.description.trim() && !project.startDate && !project.endDate
}

function normalizeStageName(name: string | undefined, text: Copy) {
  if (!name || !name.trim()) {
    return text.untitledStage
  }

  const trimmed = name.trim()
  if (trimmed.endsWith(' Week')) {
    return trimmed.slice(0, -5)
  }

  return trimmed
}

function isReservedEmptyStageName(name: string | undefined) {
  return name?.trim() === '-'
}

function findStage(stages: StageTemplate[], stageId: string) {
  return stages.find((stage) => stage.id === stageId)
}

function normalizeStageColorKey(value: string | undefined): StageColorKey | undefined {
  return stageColorOrder.includes(value as StageColorKey) ? (value as StageColorKey) : undefined
}

function normalizeScheduleMode(
  value: Project['scheduleMode'] | undefined,
  endDateMode: Project['endDateMode'],
  endDate: string,
): ScheduleMode {
  if (value === 'date-driven' || value === 'week-driven') {
    return value
  }
  if (endDate && endDateMode === 'manual') {
    return 'date-driven'
  }
  return 'week-driven'
}

function inferStageColorKey(
  stage: Pick<StageTemplate, 'id' | 'name' | 'efficiency' | 'planningMode'>,
): StageColorKey {
  const normalizedName = stage.name.trim().toLowerCase()

  if (stage.planningMode === 'schedule-only') {
    return 'gold'
  }

  if (stage.id === 'start' || /(start|kickoff|begin|open|启动)/.test(normalizedName)) {
    return 'mist'
  }

  if (stage.id === 'wrap' || /(wrap|close|finish|end|final|整理|收尾)/.test(normalizedName)) {
    return 'mist'
  }

  if (stage.id === 'buffer' || /(buffer|polish|review|revise|revision|缓冲|修订)/.test(normalizedName)) {
    return 'sage'
  }

  if (stage.id === 'theme' || /(theme|concept|palette|motif|主题)/.test(normalizedName)) {
    return 'teal'
  }

  if (stage.id === 'sprint' || /(sprint|rush|push|冲刺)/.test(normalizedName)) {
    return 'red'
  }

  if (/(mix|mixing|master|delivery|print|stem|混音|交付)/.test(normalizedName)) {
    return 'gold'
  }

  if (stage.id === 'efficient' || /(efficient|efficiency|drive|效率)/.test(normalizedName)) {
    return 'orange'
  }

  if (stage.id === 'complex' || /(complex|dense|hard|复杂)/.test(normalizedName)) {
    return 'amber'
  }

  if (stage.efficiency >= 1.3) {
    return 'red'
  }
  if (stage.efficiency >= 1.1) {
    return 'orange'
  }
  if (stage.efficiency >= 0.7) {
    return 'amber'
  }
  return 'mist'
}

function getResolvedStageColorKey(stage: StageTemplate | undefined): StageColorKey {
  if (!stage) {
    return 'sage'
  }
  return normalizeStageColorKey(stage.colorKey) ?? inferStageColorKey(stage)
}

function getStageColorLabel(colorKey: StageColorKey, language: Language) {
  return stageColorMeta[colorKey].label[language]
}

function getColorAppearanceStyle(colorKey: StageColorKey) {
  const meta = stageColorMeta[colorKey]
  return {
    ['--stage-chip-background' as string]: meta.chipBackground,
    ['--stage-chip-border' as string]: meta.chipBorder,
    ['--stage-chip-text' as string]: meta.chipText,
    ['--stage-segment-start' as string]: meta.segmentStart,
    ['--stage-segment-end' as string]: meta.segmentEnd,
  }
}

function getStageAppearanceStyle(stage: StageTemplate | undefined) {
  return getColorAppearanceStyle(getResolvedStageColorKey(stage))
}

function getStageDisplayName(stage: StageTemplate | undefined, language: Language) {
  if (!stage) {
    return '-'
  }

  if (stage.isDefault) {
    return defaultStageLabels[language][stage.id as keyof typeof defaultStageLabels.en] ?? stage.name
  }

  return stage.name
}

function getStageName(stages: StageTemplate[], stageId: string, language: Language) {
  return getStageDisplayName(findStage(stages, stageId), language)
}

function hasAssignedStage(stages: StageTemplate[], stageId: string) {
  return Boolean(stageId && findStage(stages, stageId))
}

function getStageEfficiency(stages: StageTemplate[], stageId: string) {
  const stage = findStage(stages, stageId)
  if (!stage || stage.planningMode === 'schedule-only') {
    return 0
  }

  return stage.efficiency
}

function getStagePlanningMode(stages: StageTemplate[], stageId: string): StagePlanningMode {
  return findStage(stages, stageId)?.planningMode === 'schedule-only' ? 'schedule-only' : 'timed'
}

function normalizeStagePlanningMode(value: StageTemplate['planningMode']) {
  return value === 'schedule-only' ? 'schedule-only' : 'timed'
}

function parseDurationToSeconds(value: string): number {
  const trimmed = value.trim()
  if (!trimmed) {
    return 0
  }

  const normalized = trimmed.replace(/[：]/g, ':')
  const parts = normalized.split(':').map((part) => part.trim())
  if (parts.some((part) => part === '' || Number.isNaN(Number(part)))) {
    return 0
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts.map(Number)
    return hours * 3600 + minutes * 60 + seconds
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts.map(Number)
    if (seconds > 59) {
      return 0
    }
    return minutes * 60 + seconds
  }

  return parts[0].length <= 2 ? Number(parts[0]) * 60 : 0
}

function formatMinuteSecond(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds))
  const totalMinutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${String(totalMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatMinutesTotalShort(totalSeconds: number, language: Language) {
  const totalMinutes = Math.max(0, Math.round(totalSeconds / 60))
  return language === 'zh' ? `${totalMinutes}分` : `${totalMinutes}m`
}

function formatPlannedActualTooltip(plannedSeconds: number, actualSeconds: number, language: Language) {
  if (language === 'zh') {
    return `计划 ${formatMinuteSecond(plannedSeconds)} · 实际 ${formatMinuteSecond(actualSeconds)}`
  }

  return `Planned ${formatMinuteSecond(plannedSeconds)} · Actual ${formatMinuteSecond(actualSeconds)}`
}

function formatPlannedActualMinutesSummary(plannedSeconds: number, actualSeconds: number, language: Language) {
  if (language === 'zh') {
    return `计 ${formatMinutesTotalShort(plannedSeconds, language)} · 实 ${formatMinutesTotalShort(actualSeconds, language)}`
  }

  return `P ${formatMinutesTotalShort(plannedSeconds, language)} · A ${formatMinutesTotalShort(actualSeconds, language)}`
}

function formatGanttModeValue(mode: GanttTimeMode, seconds: number, language: Language) {
  if (mode === 'delta') {
    const sign = seconds > 0 ? '+' : seconds < 0 ? '-' : ''
    const label = language === 'zh' ? '差' : 'D'
    return `${label} ${sign}${formatMinutesTotalShort(Math.abs(seconds), language)}`
  }

  const prefix =
    mode === 'planned'
      ? language === 'zh'
        ? '计'
        : 'P'
      : language === 'zh'
      ? '实'
      : 'A'

  return `${prefix} ${formatMinutesTotalShort(seconds, language)}`
}

function formatCloudSyncError(error: unknown, language: Language) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const normalizedMessage = message.toLowerCase()

  if (
    normalizedMessage.includes('relation "public.user_workspaces" does not exist') ||
    normalizedMessage.includes('relation "user_workspaces" does not exist') ||
    normalizedMessage.includes('relation "public.workspaces" does not exist') ||
    normalizedMessage.includes('relation "public.workspace_members" does not exist') ||
    normalizedMessage.includes('relation "public.workspace_state" does not exist') ||
    normalizedMessage.includes('could not find the table')
  ) {
    return language === 'zh'
      ? '团队同步表还没创建。先去 Supabase SQL Editor 重新执行 supabase/schema.sql。'
      : 'The team sync tables are missing. Re-run supabase/schema.sql in the Supabase SQL Editor first.'
  }

  if (normalizedMessage.includes('row-level security') || normalizedMessage.includes('permission denied')) {
    return language === 'zh'
      ? '云同步权限还没配好。请确认已经执行 supabase/schema.sql 里的 RLS 策略。'
      : 'Cloud sync permissions are not ready yet. Make sure the RLS policies in supabase/schema.sql have been applied.'
  }

  return message || (language === 'zh' ? '云同步失败。' : 'Cloud sync failed.')
}

function getDefaultPlannedForStage(stageId: string, stages: StageTemplate[]) {
  const baselineSeconds = parseDurationToSeconds(DEFAULT_BASELINE_WEEKLY_TARGET)
  return formatMinuteSecond(Math.round(baselineSeconds * getStageEfficiency(stages, stageId)))
}

function getDistributedPlannedSeconds(totalScoreSeconds: number, weeks: WeekPlan[], stages: StageTemplate[]) {
  if (totalScoreSeconds <= 0 || weeks.length === 0) {
    return weeks.map(() => 0)
  }

  const weights = weeks.map((week) => Math.max(0, getStageEfficiency(stages, week.stageId)))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)

  if (totalWeight <= 0) {
    const evenShare = Math.floor(totalScoreSeconds / weeks.length)
    const remainder = totalScoreSeconds - evenShare * weeks.length
    return weeks.map((_, index) => evenShare + (index < remainder ? 1 : 0))
  }

  const rawAllocations = weights.map((weight) => (totalScoreSeconds * weight) / totalWeight)
  const baseAllocations = rawAllocations.map((value) => Math.floor(value))
  let remainder = totalScoreSeconds - baseAllocations.reduce((sum, value) => sum + value, 0)

  const indexedFractions = rawAllocations
    .map((value, index) => ({
      index,
      fraction: value - Math.floor(value),
    }))
    .sort((left, right) => right.fraction - left.fraction)

  for (let index = 0; index < indexedFractions.length && remainder > 0; index += 1) {
    baseAllocations[indexedFractions[index].index] += 1
    remainder -= 1
  }

  return baseAllocations
}

function sanitizeTimeInput(value: string) {
  const normalized = value.replace(/[^\d:：]/g, '').replace(/[：]/g, ':')
  const colonIndex = normalized.indexOf(':')

  if (colonIndex === -1) {
    return normalized.slice(0, 4)
  }

  const minutes = normalized.slice(0, colonIndex).replace(/[^\d]/g, '').slice(0, 4)
  const seconds = normalized
    .slice(colonIndex + 1)
    .replace(/[^\d]/g, '')
    .slice(0, 2)

  return `${minutes}:${seconds}`
}

function finalizeTimeInput(value: string) {
  const sanitized = sanitizeTimeInput(value)
  if (!sanitized.trim()) {
    return ''
  }

  const colonIndex = sanitized.indexOf(':')
  if (colonIndex === -1) {
    return `${sanitized}:00`
  }

  const minutes = sanitized.slice(0, colonIndex).replace(/[^\d]/g, '').slice(0, 4)
  const seconds = sanitized
    .slice(colonIndex + 1)
    .replace(/[^\d]/g, '')
    .slice(0, 2)

  return `${minutes}:${seconds.padEnd(2, '0')}`
}

function isValidTimeInput(value: string) {
  if (!value.trim()) {
    return true
  }

  const match = value.trim().match(/^(\d{1,4}):(\d{2})$/)
  if (!match) {
    return false
  }

  return Number(match[2]) <= 59
}

function parseLocalDate(value: string) {
  if (!value) {
    return null
  }

  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) {
    return null
  }

  return new Date(year, month - 1, day)
}

function getScheduleStartDate(startDate: string) {
  return parseLocalDate(startDate)
}

function countWorkdaysInRange(start: Date, end: Date) {
  let count = 0
  const cursor = new Date(start)

  while (cursor <= end) {
    const day = cursor.getDay()
    if (day >= 1 && day <= 5) {
      count += 1
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return count
}

function deriveWeekSegments(startDate: string, endDate: string) {
  const start = getScheduleStartDate(startDate)
  const end = parseLocalDate(endDate)

  if (!start || !end || end < start) {
    return null
  }

  const segments: Array<{ calendarDays: number; workDays: number }> = []
  let cursor = new Date(start)

  while (cursor <= end) {
    const segmentStart = new Date(cursor)
    const segmentEnd = new Date(cursor)
    const daysUntilSunday = (7 - segmentStart.getDay()) % 7
    segmentEnd.setDate(segmentEnd.getDate() + daysUntilSunday)

    if (segmentEnd > end) {
      segmentEnd.setTime(end.getTime())
    }

    segments.push({
      calendarDays: Math.floor((segmentEnd.getTime() - segmentStart.getTime()) / DAY_MS) + 1,
      workDays: countWorkdaysInRange(segmentStart, segmentEnd),
    })

    cursor = new Date(segmentEnd)
    cursor.setDate(cursor.getDate() + 1)
  }

  return segments
}

function deriveWeekDays(startDate: string, endDate: string) {
  return deriveWeekSegments(startDate, endDate)?.map((segment) => segment.workDays) ?? null
}

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatShortDate(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${month}/${day}`
}

function formatMonthHeader(value: Date, language: Language) {
  if (language === 'zh') {
    return `${value.getFullYear()}年${value.getMonth() + 1}月`
  }

  return value.toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

function clampIndex(value: number, length: number) {
  return Math.max(0, Math.min(length - 1, value))
}

function deriveAutoEndDate(startDate: string, weekCount: number) {
  const start = getScheduleStartDate(startDate)
  if (!start) {
    return ''
  }

  const safeWeekCount = Math.max(1, weekCount)
  const end = new Date(start)
  const daysUntilSunday = (7 - start.getDay()) % 7
  end.setDate(end.getDate() + daysUntilSunday + Math.max(0, safeWeekCount - 1) * 7)
  return formatDateInput(end)
}

function resizeWeeks(weeks: WeekPlan[], nextCount: number) {
  const safeCount = Math.max(1, nextCount)
  const nextWeeks = weeks.slice(0, safeCount)

  while (nextWeeks.length < safeCount) {
    nextWeeks.push(createWeek(nextWeeks.length))
  }

  return nextWeeks
}

function applyDerivedWeekDays(
  weeks: WeekPlan[],
  targetWeekDays: number[],
  keepExtraWeeks = true,
) {
  const nextCount = keepExtraWeeks
    ? Math.max(weeks.length, targetWeekDays.length)
    : targetWeekDays.length
  return resizeWeeks(weeks, nextCount).map((week, index) =>
    index < targetWeekDays.length
      ? {
          ...week,
          days: Math.max(1, targetWeekDays[index]),
        }
      : week,
  )
}

function syncProjectSchedule(project: Project) {
  const invalidStageIds = new Set(
    project.stages
      .filter((stage) => isReservedEmptyStageName(stage.name))
      .map((stage) => stage.id),
  )

  if (invalidStageIds.size === 0) {
    return project
  }

  return {
    ...project,
    stages: project.stages.filter((stage) => !invalidStageIds.has(stage.id)),
    weeks: project.weeks.map((week) =>
      invalidStageIds.has(week.stageId)
        ? {
            ...week,
            stageId: '',
            planned: '00:00',
          }
        : week,
    ),
  }
}

function startOfToday() {
  const today = new Date()
  return new Date(today.getFullYear(), today.getMonth(), today.getDate())
}

function ensureUniqueStageName(stages: StageTemplate[], baseName: string, text: Copy) {
  const trimmed = !baseName.trim() || isReservedEmptyStageName(baseName) ? text.newStage : baseName.trim()
  if (!stages.some((stage) => stage.name === trimmed)) {
    return trimmed
  }

  let suffix = 2
  while (stages.some((stage) => stage.name === `${trimmed} ${suffix}`)) {
    suffix += 1
  }

  return `${trimmed} ${suffix}`
}

function resolveStageIdByName(stages: StageTemplate[], name: string) {
  return stages.find((stage) => stage.name === name)?.id ?? stages[0]?.id ?? ''
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function buildProjectCsv(project: Project) {
  const rows: string[][] = [
    ['section', 'project_name', 'project_description', 'score_duration', 'start_date', 'end_date', 'schedule_mode'],
    [
      'project',
      project.name,
      project.description,
      project.scoreDuration,
      project.startDate,
      project.endDate,
      project.scheduleMode,
    ],
    [],
    ['section', 'stage_id', 'stage_name', 'efficiency', 'planning_mode', 'color_key'],
    ...project.stages.map((stage) => [
      'stage',
      stage.id,
      stage.name,
      stage.efficiency.toFixed(1),
      stage.planningMode ?? 'timed',
      getResolvedStageColorKey(stage),
    ]),
    [],
    ['section', 'week_number', 'stage_id', 'days', 'planned', 'actual', 'notes'],
    ...project.weeks.map((week, index) => [
      'week',
      String(index + 1),
      week.stageId,
      String(week.days),
      week.planned,
      week.actual,
      week.notes,
    ]),
  ]

  return rows.map((row) => row.map(csvEscape).join(',')).join('\n')
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentValue = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const nextChar = text[index + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentValue += '"'
        index += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        currentValue += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      currentRow.push(currentValue)
      currentValue = ''
    } else if (char === '\n') {
      currentRow.push(currentValue)
      rows.push(currentRow)
      currentRow = []
      currentValue = ''
    } else if (char !== '\r') {
      currentValue += char
    }
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue)
    rows.push(currentRow)
  }

  return rows.filter((row) => row.length > 0 && row.some((value) => value !== ''))
}

function importProjectFromCsv(content: string, language: Language): Project | null {
  const rows = parseCsv(content)
  const stages: StageTemplate[] = []
  const weeks: WeekPlan[] = []
  let name = ''
  let description = ''
  let scoreDuration = ''
  let startDate = ''
  let endDate = ''
  let scheduleMode: ScheduleMode | undefined

  rows.forEach((row) => {
    if (row[0] === 'project') {
      name = row[1] ?? ''
      if (row.length >= 7) {
        description = row[2] ?? ''
        scoreDuration = row[3] ?? ''
        startDate = row[4] ?? ''
        endDate = row[5] ?? ''
        scheduleMode = row[6] as ScheduleMode | undefined
      } else if (row.length >= 6) {
        description = row[2] ?? ''
        scoreDuration = row[3] ?? ''
        startDate = row[4] ?? ''
        endDate = row[5] ?? ''
      } else if (row.length >= 5) {
        description = row[2] ?? ''
        startDate = row[3] ?? ''
        endDate = row[4] ?? ''
      } else {
        startDate = row[2] ?? ''
        endDate = row[3] ?? ''
      }
    }

    if (row[0] === 'stage') {
      const planningMode = normalizeStagePlanningMode(row[4] as StageTemplate['planningMode'])
      stages.push({
        id: row[1] || createId('stage'),
        name: row[2] || copy[language].untitledStage,
        efficiency: Math.max(0, Number(row[3]) || 1),
        planningMode,
        colorKey:
          normalizeStageColorKey(row[5]) ??
          inferStageColorKey({
            id: row[1] || '',
            name: row[2] || copy[language].untitledStage,
            efficiency: Math.max(0, Number(row[3]) || 1),
            planningMode,
          }),
      })
    }

    if (row[0] === 'week') {
      weeks.push({
        id: createId('week'),
        stageId: row[2] || '',
        days: Math.max(1, Math.min(7, Number(row[3]) || 5)),
        planned: sanitizeTimeInput(row.length >= 7 ? row[4] || '' : ''),
        actual: sanitizeTimeInput(row.length >= 7 ? row[5] || '' : row[4] || ''),
        notes: row.length >= 7 ? row[6] || '' : row[5] || '',
      })
    }
  })

  const fallbackStages = stages.length > 0 ? stages : getDefaultStages(language)
  const fallbackWeeks = weeks.length > 0
      ? weeks.map((week, index) => ({
          ...week,
          id: week.id || createId(`week-${index + 1}`),
          stageId: findStage(fallbackStages, week.stageId)
            ? week.stageId
            : fallbackStages[0]?.id ?? '',
          planned: week.planned || getDefaultPlannedForStage(week.stageId, fallbackStages),
        }))
    : Array.from({ length: 8 }, (_, index) => createWeek(index))

  if (fallbackStages.length === 0 || fallbackWeeks.length === 0) {
    return null
  }

  return syncProjectSchedule({
    id: createId('project'),
    name,
    description,
    scoreDuration,
    startDate,
    endDate,
    endDateMode: startDate && endDate ? 'manual' : 'auto',
    scheduleMode: normalizeScheduleMode(scheduleMode, startDate && endDate ? 'manual' : 'auto', endDate),
    stages: fallbackStages,
    weeks: fallbackWeeks,
  })
}

function migrateLegacyProject(saved: string, language: Language): Project | null {
  try {
    const parsed = JSON.parse(saved) as LegacyProjectState
    const defaultProject = createDefaultProject(language)
    const stages: StageTemplate[] = Array.isArray(parsed.stages) && parsed.stages.length > 0
        ? parsed.stages.map((stage) => ({
          id: stage.id || createId('stage'),
          name: normalizeStageName(stage.name, copy[language]),
          efficiency: typeof stage.efficiency === 'number' ? stage.efficiency : 1,
          planningMode: normalizeStagePlanningMode(stage.planningMode),
          colorKey:
            normalizeStageColorKey(stage.colorKey) ??
            inferStageColorKey({
              id: stage.id || '',
              name: normalizeStageName(stage.name, copy[language]),
              efficiency: typeof stage.efficiency === 'number' ? stage.efficiency : 1,
              planningMode: normalizeStagePlanningMode(stage.planningMode),
            }),
          isDefault: defaultStageBlueprints.some((item) => item.id === stage.id),
        }))
      : defaultProject.stages

    const totalWeeks = Math.max(1, parsed.totalWeeks || parsed.weeks?.length || 8)
    const legacyWeeks = Array.isArray(parsed.weeks) ? parsed.weeks : []
    const weeks = Array.from({ length: totalWeeks }, (_, index) => {
      const legacyWeek = legacyWeeks[index]
      if (!legacyWeek) {
        return createWeek(index)
      }

      const currentWeek = legacyWeek as WeekPlan
      if (typeof currentWeek.stageId === 'string' && typeof currentWeek.actual === 'string') {
        return {
          id: currentWeek.id || createId(`week-${index + 1}`),
          stageId: findStage(stages, currentWeek.stageId)
            ? currentWeek.stageId
            : stages[0]?.id ?? '',
          days: 5,
          planned:
            typeof currentWeek.planned === 'string' && currentWeek.planned
              ? sanitizeTimeInput(currentWeek.planned)
              : getDefaultPlannedForStage(currentWeek.stageId, stages),
          actual: sanitizeTimeInput(currentWeek.actual || ''),
          notes: currentWeek.notes || '',
        }
      }

      const oldWeek = legacyWeek as LegacyWeekPlan
      const splitActual =
        typeof oldWeek.actualMinutes === 'string' || typeof oldWeek.actualSeconds === 'string'
          ? `${oldWeek.actualMinutes || '0'}:${String(oldWeek.actualSeconds || '0').padStart(2, '0')}`
          : oldWeek.actual || ''

      return {
        id: oldWeek.id || createId(`week-${index + 1}`),
        stageId: resolveStageIdByName(stages, oldWeek.stage || ''),
        days: 5,
        planned: getDefaultPlannedForStage(resolveStageIdByName(stages, oldWeek.stage || ''), stages),
        actual: sanitizeTimeInput(splitActual),
        notes: oldWeek.notes || '',
      }
    })

    return {
      id: createId('project'),
      name: parsed.movieTitle || '',
      description: '',
      scoreDuration: '',
      startDate: '',
      endDate: '',
      endDateMode: 'auto',
      scheduleMode: 'week-driven',
      stages,
      weeks,
    }
  } catch {
    return null
  }
}

function getProjectLabel(project: Project, text: Copy, index: number) {
  return project.name.trim() || `${text.projects} ${index + 1}`
}

function getProjectSignature(project: Project) {
  return JSON.stringify({
    name: project.name.trim(),
    description: project.description.trim(),
    startDate: project.startDate,
    endDate: project.endDate,
    stages: project.stages.map((stage) => ({
      name: stage.name,
      efficiency: stage.efficiency,
      colorKey: getResolvedStageColorKey(stage),
    })),
    weeks: project.weeks.map((week) => ({
      stageId: week.stageId,
      days: week.days,
      actual: week.actual,
      notes: week.notes,
    })),
  })
}

function normalizeImportedProject(project: Partial<Project> | undefined, language: Language): Project | null {
  if (!project) {
    return null
  }

  const defaultProject = createDefaultProject(language)
  const stages: StageTemplate[] = Array.isArray(project.stages) && project.stages.length > 0
    ? project.stages.map((stage) => {
        const planningMode = normalizeStagePlanningMode(stage.planningMode)
        const name = normalizeStageName(stage.name, copy[language])
        return {
          id: stage.id || createId('stage'),
          name,
          efficiency: typeof stage.efficiency === 'number' ? Math.max(0, stage.efficiency) : 1,
          planningMode,
          colorKey:
            normalizeStageColorKey(stage.colorKey) ??
            inferStageColorKey({
              id: stage.id || '',
              name,
              efficiency: typeof stage.efficiency === 'number' ? Math.max(0, stage.efficiency) : 1,
              planningMode,
            }),
          isDefault: defaultStageBlueprints.some((item) => item.id === stage.id),
        }
      })
    : defaultProject.stages

  const rawWeeks = Array.isArray(project.weeks) && project.weeks.length > 0 ? project.weeks : defaultProject.weeks
  let weeks = rawWeeks.map((week, index) => ({
    id: week.id || createId(`week-${index + 1}`),
    stageId: findStage(stages, week.stageId || '') ? (week.stageId as string) : '',
    days: Math.max(1, Math.min(7, Number(week.days) || 5)),
    planned: sanitizeTimeInput(week.planned || ''),
    actual: sanitizeTimeInput(week.actual || ''),
    notes: typeof week.notes === 'string' ? week.notes : '',
  }))

  const startDate = typeof project.startDate === 'string' ? project.startDate : ''
  const endDate = typeof project.endDate === 'string' ? project.endDate : ''
  const endDateMode: Project['endDateMode'] =
    project.endDateMode === 'manual' || project.endDateMode === 'auto'
      ? project.endDateMode
      : startDate && endDate
      ? 'manual'
      : 'auto'
  const scheduleMode = normalizeScheduleMode(project.scheduleMode, endDateMode, endDate)

  const derivedWeekDays = deriveWeekDays(startDate, endDate)
  if (derivedWeekDays) {
    weeks = applyDerivedWeekDays(weeks, derivedWeekDays, scheduleMode !== 'date-driven')
  }

  return syncProjectSchedule({
    id: project.id || createId('project'),
    name: typeof project.name === 'string' ? project.name : '',
    description: typeof project.description === 'string' ? project.description : '',
    scoreDuration: sanitizeTimeInput(project.scoreDuration || ''),
    startDate,
    endDate,
    endDateMode,
    scheduleMode,
    stages,
    weeks,
  })
}

function importWorkspaceFromJson(content: string, language: Language): WorkspaceState | null {
  try {
    const parsed = JSON.parse(content) as unknown
    const candidate: WorkspaceState | null =
      parsed && typeof parsed === 'object' && 'workspace' in parsed
        ? (((parsed as { workspace?: WorkspaceState }).workspace as WorkspaceState | undefined) ?? null)
        : ((parsed as WorkspaceState | undefined) ?? null)

    if (!candidate || !Array.isArray(candidate.projects) || candidate.projects.length === 0) {
      return null
    }

    const projects = candidate.projects
      .map((project: Project) => normalizeImportedProject(project, language))
      .filter((project): project is Project => Boolean(project))

    if (projects.length === 0) {
      return null
    }

    const activeProjectId = projects.some((project) => project.id === candidate.activeProjectId)
      ? candidate.activeProjectId
      : projects[0].id

    return {
      projects,
      activeProjectId,
    }
  } catch {
    return null
  }
}

function loadSavedAuth() {
  const empty = { email: '', password: '', remember: true }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) {
      return empty
    }

    const parsed = JSON.parse(raw) as { email?: string; password?: string; remember?: boolean }
    return {
      email: typeof parsed.email === 'string' ? parsed.email : '',
      password: typeof parsed.password === 'string' ? parsed.password : '',
      remember: parsed.remember !== false,
    }
  } catch {
    return empty
  }
}

function App() {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return saved === 'zh' ? 'zh' : 'en'
  })
  const text = copy[language]
  const appShellRef = useRef<HTMLElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const libraryInputRef = useRef<HTMLInputElement | null>(null)
  const activeStagePickerTriggerRef = useRef<HTMLButtonElement | null>(null)
  const stageEditorNameInputRef = useRef<HTMLInputElement | null>(null)
  const projectEditorNameInputRef = useRef<HTMLInputElement | null>(null)

  const [activeStagePickerWeekId, setActiveStagePickerWeekId] = useState<string | null>(null)
  const [activeStagePickerPlacement, setActiveStagePickerPlacement] = useState<'up' | 'down'>('down')
  const [activeStagePopupPosition, setActiveStagePopupPosition] = useState<StagePopupPosition | null>(null)
  const [stageEditor, setStageEditor] = useState<StageEditorState | null>(null)
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false)
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false)
  const [isTeamManagerOpen, setIsTeamManagerOpen] = useState(false)
  const [projectEditor, setProjectEditor] = useState<ProjectEditorState | null>(null)
  const [importConflict, setImportConflict] = useState<ImportConflictState | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [ganttTimeMode, setGanttTimeMode] = useState<GanttTimeMode>('planned')
  const [ganttHorizontalZoomIndex, setGanttHorizontalZoomIndex] = useState(3)
  const [ganttVerticalZoomIndex, setGanttVerticalZoomIndex] = useState(4)
  const [isExportingImage, setIsExportingImage] = useState(false)
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false)
  const [isTooltipModifierActive, setIsTooltipModifierActive] = useState(false)
  const [authSession, setAuthSession] = useState<Session | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(isSupabaseConfigured)
  const [isCloudWorkspaceReady, setIsCloudWorkspaceReady] = useState(!isSupabaseConfigured)
  const [authEmail, setAuthEmail] = useState(() => loadSavedAuth().email)
  const [authPassword, setAuthPassword] = useState(() => loadSavedAuth().password)
  const [rememberAuth, setRememberAuth] = useState(() => loadSavedAuth().remember)
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [isAwaitingEmailConfirmation, setIsAwaitingEmailConfirmation] = useState(false)
  const [cloudWorkspaceName, setCloudWorkspaceName] = useState('')
  const [cloudWorkspaceRole, setCloudWorkspaceRole] = useState<'owner' | 'editor' | 'viewer' | ''>('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [isInviteSubmitting, setIsInviteSubmitting] = useState(false)
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberRecord[]>([])
  const [isWorkspaceMembersLoading, setIsWorkspaceMembersLoading] = useState(false)
  const [memberActionMessage, setMemberActionMessage] = useState('')
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle')
  const lastCloudWorkspaceRef = useRef<string | null>(null)

  const [workspace, setWorkspace] = useState<WorkspaceState>(() => {
    const savedWorkspace = window.localStorage.getItem(STORAGE_KEY)
    if (savedWorkspace) {
      try {
        const parsed = JSON.parse(savedWorkspace) as WorkspaceState
        if (Array.isArray(parsed.projects) && parsed.projects.length > 0) {
          return {
            projects: parsed.projects
              .map((project): Project => ({
                ...(() => {
                  const name = project.name || ''
                  const description = project.description || ''
                  const startDate = project.startDate || ''
                  const endDate = project.endDate || ''
                  const scheduleMode = normalizeScheduleMode(
                    project.scheduleMode,
                    project.endDateMode === 'manual' ? 'manual' : 'auto',
                    endDate,
                  )
                  const stages = project.stages?.length ? project.stages : getDefaultStages(language)
                  const weeks = (project.weeks?.length ? project.weeks : createDefaultProject(language).weeks)
                    .map((week, index) => {
                      const stageId =
                        typeof week.stageId === 'string'
                          ? week.stageId
                          : getDefaultWeekStageId(index, stages)

                      return {
                        ...week,
                        stageId,
                        days: Math.max(1, Math.min(7, Number(week.days) || 5)),
                        planned: project.scoreDuration
                          ? typeof week.planned === 'string'
                            ? sanitizeTimeInput(week.planned)
                            : ''
                          : '',
                        actual: sanitizeTimeInput(week.actual || ''),
                        notes: week.notes || '',
                      }
                    })

                  return {
                    ...project,
                    name,
                    description,
                    scoreDuration: isProjectMetadataBlank({ name, description, startDate, endDate })
                      ? ''
                      : project.scoreDuration || DEFAULT_TOTAL_DURATION,
                    startDate,
                    endDate,
                    endDateMode: project.endDateMode === 'manual' ? 'manual' : 'auto',
                    scheduleMode,
                    stages: stages.map((stage): StageTemplate => ({
                      ...stage,
                      planningMode: normalizeStagePlanningMode(stage.planningMode),
                      colorKey:
                        normalizeStageColorKey(stage.colorKey) ??
                        inferStageColorKey({
                          id: stage.id,
                          name: stage.name,
                          efficiency: stage.efficiency,
                          planningMode: normalizeStagePlanningMode(stage.planningMode),
                        }),
                    })),
                    weeks,
                  }
                })(),
              }))
              .map(syncProjectSchedule),
            activeProjectId: parsed.activeProjectId || parsed.projects[0].id,
          }
        }
      } catch {
        // ignore invalid storage and continue with migration
      }
    }

    const legacyState = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacyState) {
      const migrated = migrateLegacyProject(legacyState, language)
      if (migrated) {
        return { projects: [migrated], activeProjectId: migrated.id }
      }
    }

    const project = createDefaultProject(language)
    return { projects: [project], activeProjectId: project.id }
  })

  const activeProject =
    workspace.projects.find((project) => project.id === workspace.activeProjectId) ??
    workspace.projects[0]
  const ganttDayWidth = GANTT_HORIZONTAL_ZOOMS[clampIndex(ganttHorizontalZoomIndex, GANTT_HORIZONTAL_ZOOMS.length)]
  const ganttRowHeight = GANTT_VERTICAL_ZOOMS[clampIndex(ganttVerticalZoomIndex, GANTT_VERTICAL_ZOOMS.length)]

  function handleTimeDraftChange(
    event: React.ChangeEvent<HTMLInputElement>,
    applyValue: (value: string) => void,
  ) {
    const input = event.currentTarget
    const normalized = sanitizeTimeInput(input.value)
    const nativeInputEvent = event.nativeEvent as InputEvent | undefined
    const inputType = nativeInputEvent?.inputType ?? ''
    const isDeleteAction = inputType.startsWith('delete')
    const shouldAutoFillSeconds = normalized.length >= 2 && !normalized.includes(':')

    if (isDeleteAction) {
      applyValue(normalized)
      return
    }

    if (shouldAutoFillSeconds) {
      const nextValue = `${normalized}:00`
      applyValue(nextValue)
      window.requestAnimationFrame(() => {
        input.focus()
        input.setSelectionRange(normalized.length + 1, nextValue.length)
      })
      return
    }

    applyValue(normalized)
  }

  function handleTimeCommit(
    event: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>,
    applyValue: (value: string) => void,
  ) {
    applyValue(finalizeTimeInput(event.currentTarget.value))
  }

  function handleTimeKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    applyValue: (value: string) => void,
  ) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
      return
    }

    event.preventDefault()
    handleTimeCommit(event, applyValue)
    event.currentTarget.blur()
  }

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace))
  }, [workspace])

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  }, [language])

  useEffect(() => {
    if (!rememberAuth) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        email: authEmail.trim(),
        password: authPassword,
        remember: true,
      }),
    )
  }, [authEmail, authPassword, rememberAuth])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsAuthLoading(false)
      setIsCloudWorkspaceReady(true)
      return
    }

    let isMounted = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return
      }

      if (error) {
        setAuthMessage(error.message)
      }

      setAuthSession(data.session)
      if (data.session) {
        setIsAwaitingEmailConfirmation(false)
      }
      setIsAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return
      }

      setAuthSession(session)
      if (session) {
        setIsAwaitingEmailConfirmation(false)
      }
      setIsAuthLoading(false)
      setAuthMessage('')
      setSyncStatus('idle')
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return
    }

    if (!authSession) {
      setIsCloudWorkspaceReady(false)
      lastCloudWorkspaceRef.current = null
      setCloudWorkspaceName('')
      setCloudWorkspaceRole('')
      setInviteMessage('')
      setWorkspaceMembers([])
      setMemberActionMessage('')
      return
    }

    let isMounted = true
    setIsCloudWorkspaceReady(false)
    setSyncStatus('syncing')

    loadCloudWorkspace<WorkspaceState>(workspace)
      .then((remoteWorkspace) => {
        if (!isMounted) {
          return
        }

        setCloudWorkspaceName(remoteWorkspace.workspaceName)
        setCloudWorkspaceRole(remoteWorkspace.role)
        void refreshWorkspaceMembers()

        if (remoteWorkspace.workspace) {
          const normalizedWorkspace = importWorkspaceFromJson(JSON.stringify(remoteWorkspace.workspace), language)
          if (normalizedWorkspace) {
            const serialized = JSON.stringify(normalizedWorkspace)
            lastCloudWorkspaceRef.current = serialized
            setWorkspace(normalizedWorkspace)
          }
        }

        setIsCloudWorkspaceReady(true)
        setSyncStatus('synced')
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return
        }

        setAuthMessage(formatCloudSyncError(error, language))
        setIsCloudWorkspaceReady(true)
        setSyncStatus('error')
      })

    return () => {
      isMounted = false
    }
  }, [authSession?.user.id, language])

  useEffect(() => {
    if (!isSupabaseConfigured || !authSession || !isCloudWorkspaceReady) {
      return
    }

    const serializedWorkspace = JSON.stringify(workspace)
    if (serializedWorkspace === lastCloudWorkspaceRef.current) {
      return
    }

    setSyncStatus('syncing')
    const timeoutId = window.setTimeout(() => {
      saveCloudWorkspace(workspace)
        .then((membership) => {
          lastCloudWorkspaceRef.current = serializedWorkspace
          setCloudWorkspaceName(membership.workspaceName)
          setCloudWorkspaceRole(membership.role)
          setSyncStatus('synced')
        })
        .catch((error: unknown) => {
          setAuthMessage(formatCloudSyncError(error, language))
          setSyncStatus('error')
        })
    }, 500)

    return () => window.clearTimeout(timeoutId)
  }, [authSession, isCloudWorkspaceReady, language, workspace])

  useEffect(() => {
    if (!stageEditor) {
      return
    }

    requestAnimationFrame(() => {
      stageEditorNameInputRef.current?.focus()
    })
  }, [stageEditor])

  useEffect(() => {
    if (!projectEditor) {
      return
    }

    requestAnimationFrame(() => {
      projectEditorNameInputRef.current?.focus()
    })
  }, [projectEditor])

  useEffect(() => {
    if (!activeStagePickerWeekId) {
      return
    }

    function updateStagePickerPosition(triggerElement: HTMLButtonElement) {
      const rect = triggerElement.getBoundingClientRect()
      const viewportPadding = 12
      const popupGap = 8
      const popupWidth = Math.min(240, window.innerWidth - viewportPadding * 2)
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding
      const spaceAbove = rect.top - viewportPadding
      const preferUp = spaceBelow < 220 && spaceAbove > spaceBelow
      const placement = preferUp ? 'up' : 'down'
      const availableHeight = Math.max(
        120,
        Math.min(360, placement === 'up' ? spaceAbove - popupGap : spaceBelow - popupGap),
      )
      const left = Math.min(
        Math.max(viewportPadding, rect.left),
        Math.max(viewportPadding, window.innerWidth - popupWidth - viewportPadding),
      )
      const top =
        placement === 'up'
          ? Math.max(viewportPadding, rect.top - availableHeight - popupGap)
          : Math.min(window.innerHeight - viewportPadding - availableHeight, rect.bottom + popupGap)

      setActiveStagePickerPlacement(placement)
      setActiveStagePopupPosition({
        top,
        left,
        width: popupWidth,
        maxHeight: availableHeight,
      })
    }

    function syncStagePickerPosition() {
      if (!activeStagePickerTriggerRef.current) {
        return
      }

      updateStagePickerPosition(activeStagePickerTriggerRef.current)
    }

    syncStagePickerPosition()
    window.addEventListener('resize', syncStagePickerPosition)
    window.addEventListener('scroll', syncStagePickerPosition, true)

    return () => {
      window.removeEventListener('resize', syncStagePickerPosition)
      window.removeEventListener('scroll', syncStagePickerPosition, true)
    }
  }, [activeProject.stages.length, activeStagePickerWeekId])

  useEffect(() => {
    function handleGanttZoomShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName
      const isTypingTarget =
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT' ||
        target?.isContentEditable

      if (isTypingTarget || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      const key = event.key.toLowerCase()
      if (key !== 'g' && key !== 'h') {
        return
      }

      event.preventDefault()

      if (event.shiftKey) {
        setGanttVerticalZoomIndex((current) =>
          clampIndex(current + (key === 'g' ? -1 : 1), GANTT_VERTICAL_ZOOMS.length),
        )
        return
      }

      setGanttHorizontalZoomIndex((current) =>
        clampIndex(current + (key === 'g' ? -1 : 1), GANTT_HORIZONTAL_ZOOMS.length),
      )
    }

    window.addEventListener('keydown', handleGanttZoomShortcut)
    return () => window.removeEventListener('keydown', handleGanttZoomShortcut)
  }, [])

  useEffect(() => {
    function handleModifierKeyChange(event: KeyboardEvent) {
      setIsTooltipModifierActive(event.metaKey)
    }

    function resetModifierKey() {
      setIsTooltipModifierActive(false)
    }

    window.addEventListener('keydown', handleModifierKeyChange)
    window.addEventListener('keyup', handleModifierKeyChange)
    window.addEventListener('blur', resetModifierKey)

    return () => {
      window.removeEventListener('keydown', handleModifierKeyChange)
      window.removeEventListener('keyup', handleModifierKeyChange)
      window.removeEventListener('blur', resetModifierKey)
    }
  }, [])

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return
      }

      if (stageEditor) {
        setStageEditor(null)
        return
      }

      if (projectEditor) {
        setProjectEditor(null)
        return
      }

      if (importConflict) {
        setImportConflict(null)
        return
      }

      if (activeStagePickerWeekId) {
        activeStagePickerTriggerRef.current = null
        setActiveStagePopupPosition(null)
        setActiveStagePickerWeekId(null)
        return
      }

      if (isProjectPickerOpen) {
        setIsProjectPickerOpen(false)
        return
      }

      if (isActionMenuOpen) {
        setIsActionMenuOpen(false)
        return
      }
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement

      if (isProjectPickerOpen && !target.closest('.project-picker')) {
        setIsProjectPickerOpen(false)
      }

      if (activeStagePickerWeekId && !target.closest('.stage-picker')) {
        activeStagePickerTriggerRef.current = null
        setActiveStagePopupPosition(null)
        setActiveStagePickerWeekId(null)
      }

      if (isActionMenuOpen && !target.closest('.action-menu-wrapper')) {
        setIsActionMenuOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeydown)
    window.addEventListener('mousedown', handlePointerDown)
    return () => {
      window.removeEventListener('keydown', handleKeydown)
      window.removeEventListener('mousedown', handlePointerDown)
    }
  }, [activeStagePickerWeekId, importConflict, isProjectPickerOpen, isActionMenuOpen, projectEditor, stageEditor])

  const calculatedWeeks = useMemo(() => {
    const totalScoreSeconds = parseDurationToSeconds(activeProject.scoreDuration)
    const autoPlannedSeconds = getDistributedPlannedSeconds(
      totalScoreSeconds,
      activeProject.weeks,
      activeProject.stages,
    )
    const projectStartDate = getScheduleStartDate(activeProject.startDate)
    const calendarWeekSegments = deriveWeekSegments(activeProject.startDate, activeProject.endDate) ?? []
    const calendarWeekSpans = calendarWeekSegments.map((segment) => segment.calendarDays)
    const dayOffsets = activeProject.weeks.map((_, index) =>
      calendarWeekSpans
        .slice(0, index)
        .reduce((sum, currentWeekDays) => sum + currentWeekDays, 0),
    )

    return activeProject.weeks.map((week, index) => {
        const isStageAssigned = hasAssignedStage(activeProject.stages, week.stageId)
        const planningMode = getStagePlanningMode(activeProject.stages, week.stageId)
        const usesTimedPlanning = isStageAssigned && planningMode === 'timed'
        const isPlannedValid = usesTimedPlanning && isValidTimeInput(week.planned)
        const isActualValid = usesTimedPlanning && isValidTimeInput(week.actual)
        const plannedValue =
          totalScoreSeconds > 0 && usesTimedPlanning
            ? formatMinuteSecond(autoPlannedSeconds[index] ?? 0)
            : usesTimedPlanning
            ? week.planned
            : ''
        const displayPlannedValid = usesTimedPlanning && isValidTimeInput(plannedValue)
        const plannedSeconds = displayPlannedValid ? parseDurationToSeconds(plannedValue) : 0
        const actualSeconds = isActualValid ? parseDurationToSeconds(week.actual) : 0
        const hasActual = isActualValid && week.actual.trim().length > 0
        const rangeStart = projectStartDate ? new Date(projectStartDate) : null

        if (rangeStart) {
          rangeStart.setDate(rangeStart.getDate() + dayOffsets[index])
        }

        const rangeEnd = rangeStart ? new Date(rangeStart) : null
        if (rangeEnd) {
          rangeEnd.setDate(rangeEnd.getDate() + Math.max((calendarWeekSpans[index] ?? 7) - 1, 0))
        }

        return {
          ...week,
          index: index + 1,
          weekLabel: language === 'zh' ? `第${index + 1}周` : `Week ${index + 1}`,
          stageName: getStageName(activeProject.stages, week.stageId, language),
          hasAssignedStage: isStageAssigned,
          planningMode,
          usesTimedPlanning,
          isPlannedValid: totalScoreSeconds > 0 ? displayPlannedValid : isPlannedValid,
          isActualValid,
          rangeLabel:
            rangeStart && rangeEnd
              ? `${formatShortDate(rangeStart)} - ${formatShortDate(rangeEnd)}`
              : '-',
          plannedValue,
          plannedSeconds,
          actualSeconds,
          hasActual,
          varianceSeconds: actualSeconds - plannedSeconds,
        }
      })
  }, [activeProject.endDate, activeProject.scoreDuration, activeProject.stages, activeProject.startDate, activeProject.weeks, language])

  const timeline = useMemo(() => {
    const rawStartDate = parseLocalDate(activeProject.startDate)
    const startDate = getScheduleStartDate(activeProject.startDate)
    const endDate = parseLocalDate(activeProject.endDate)
    const today = startOfToday()
    const targetWeekSegments = deriveWeekSegments(activeProject.startDate, activeProject.endDate)
    const targetWeeks = targetWeekSegments?.length ?? activeProject.weeks.length
    const effectiveTotalWeeks =
      activeProject.scheduleMode === 'date-driven'
        ? targetWeeks
        : Math.max(activeProject.weeks.length, targetWeeks)

    if (!rawStartDate || !startDate || !endDate || endDate < startDate) {
      return {
        currentWeek: '-',
        currentWeekIndex: null as number | null,
        daysLeft: '-',
        weeksLeft: '-',
        totalDays: '-',
      }
    }

    const totalDaysRaw = Math.floor((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1
    const daysLeftRaw =
      today < startDate
        ? totalDaysRaw
        : Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / DAY_MS))
    let currentWeek: string | number = '-'
    let currentWeekIndex: number | null = null
    if (today >= startDate && today <= endDate) {
      const elapsedDays = Math.floor((today.getTime() - startDate.getTime()) / DAY_MS)

      if (targetWeekSegments?.length) {
        let dayCursor = 0

        for (let index = 0; index < targetWeekSegments.length; index += 1) {
          dayCursor += targetWeekSegments[index].calendarDays
          if (elapsedDays < dayCursor) {
            currentWeek = index + 1
            currentWeekIndex = index
            break
          }
        }
      }

      if (currentWeekIndex === null) {
      currentWeek = Math.min(effectiveTotalWeeks, Math.floor(elapsedDays / 7) + 1)
      currentWeekIndex = Number(currentWeek) - 1
    }
  } else if (today > endDate) {
      currentWeek = effectiveTotalWeeks
      currentWeekIndex = effectiveTotalWeeks - 1
    }

    const weeksLeftRaw =
      today < startDate
        ? effectiveTotalWeeks
        : currentWeekIndex === null
        ? effectiveTotalWeeks
        : Math.max(0, effectiveTotalWeeks - currentWeekIndex - 1)

    return {
      currentWeek: String(currentWeek),
      currentWeekIndex,
      daysLeft: `${daysLeftRaw}/${totalDaysRaw}`,
      weeksLeft: String(weeksLeftRaw),
      totalDays: String(totalDaysRaw),
    }
  }, [activeProject.endDate, activeProject.scheduleMode, activeProject.startDate, activeProject.weeks])

  const writingTimeline = useMemo(() => {
    const writingWeeks = calculatedWeeks.filter((week) => week.usesTimedPlanning)
    const scheduleWeeks = calculatedWeeks.filter((week) => week.planningMode === 'schedule-only')
    const totalWritingDays = writingWeeks.reduce((sum, week) => sum + week.days, 0)
    const totalScheduleDays = scheduleWeeks.reduce((sum, week) => sum + week.days, 0)
    if (timeline.currentWeekIndex === null) {
      return {
        currentWeek: '-',
        writingDaysLeft: `${totalWritingDays}/${totalWritingDays}`,
        scheduleDaysLeft: `${totalScheduleDays}/${totalScheduleDays}`,
      }
    }

    const completedWritingWeeks = writingWeeks.filter((week) => week.index - 1 <= timeline.currentWeekIndex!).length

    return {
      currentWeek: String(completedWritingWeeks),
      writingDaysLeft: `${writingWeeks
        .filter((week) => week.index - 1 > timeline.currentWeekIndex!)
        .reduce((sum, week) => sum + week.days, 0)}/${totalWritingDays}`,
      scheduleDaysLeft: `${scheduleWeeks
        .filter((week) => week.index - 1 > timeline.currentWeekIndex!)
        .reduce((sum, week) => sum + week.days, 0)}/${totalScheduleDays}`,
    }
  }, [calculatedWeeks, timeline.currentWeekIndex])

  const summary = useMemo(() => {
    const totalScoreSeconds = parseDurationToSeconds(activeProject.scoreDuration)
    const timedWeeks = calculatedWeeks.filter((week) => week.usesTimedPlanning)
    const scheduleOnlyWeeks = calculatedWeeks.filter((week) => week.planningMode === 'schedule-only')
    const totalPlannedSeconds =
      totalScoreSeconds > 0
        ? timedWeeks.reduce((sum, week) => sum + week.plannedSeconds, 0)
        : 0
    const totalActualSeconds = timedWeeks.reduce((sum, week) => sum + week.actualSeconds, 0)
    const hasUnassignedStages = calculatedWeeks.some((week) => !week.hasAssignedStage)
    const currentWeeks = activeProject.weeks.length
    const totalWorkDays = activeProject.weeks.reduce(
      (sum, week) =>
        sum + (getStagePlanningMode(activeProject.stages, week.stageId) === 'timed' ? week.days : 0),
      0,
    )
    const totalTimedWeeks = timedWeeks.length
    const targetWeekDays = deriveWeekDays(activeProject.startDate, activeProject.endDate)
    const targetWeeks = targetWeekDays?.length ?? currentWeeks
    const effectiveTotalWeeks =
      activeProject.scheduleMode === 'date-driven'
        ? targetWeeks
        : Math.max(currentWeeks, targetWeeks)
    const lastActualIndex = calculatedWeeks.reduce(
      (lastIndex, week, index) => (week.hasActual ? index : lastIndex),
      -1,
    )
    const varianceSeconds =
      lastActualIndex >= 0
        ? calculatedWeeks
            .slice(0, lastActualIndex + 1)
            .reduce((sum, week) => sum + (week.hasActual ? week.varianceSeconds : 0), 0)
        : 0
    const hasScheduleMismatch = Boolean(targetWeekDays && currentWeeks !== targetWeeks)

    return {
      totalWeeks: effectiveTotalWeeks,
      calendarWeeks: effectiveTotalWeeks,
      writingWeeks: totalTimedWeeks,
      scheduleWeeks: scheduleOnlyWeeks.length,
      writingDays: timedWeeks.reduce((sum, week) => sum + week.days, 0),
      scheduleDays: scheduleOnlyWeeks.reduce((sum, week) => sum + week.days, 0),
      isWeeksMismatch: Boolean(targetWeekDays && currentWeeks !== targetWeeks),
      isDaysMismatch: false,
      hasScheduleMismatch,
      hasUnassignedStages,
      totalPlannedSeconds,
      totalActualSeconds,
      totalScoreSeconds,
      totalMinsLeftSeconds: totalScoreSeconds > 0 ? Math.max(0, totalScoreSeconds - totalActualSeconds) : 0,
      averageWeeklySeconds: totalScoreSeconds > 0 && totalTimedWeeks > 0 ? totalPlannedSeconds / totalTimedWeeks : 0,
      averageDailySeconds: totalScoreSeconds > 0 && totalWorkDays > 0 ? totalPlannedSeconds / totalWorkDays : 0,
      varianceSeconds,
      overflowWeekStart: targetWeeks + 1,
    }
  }, [
    activeProject.endDate,
    activeProject.scheduleMode,
    activeProject.scoreDuration,
    activeProject.stages,
    activeProject.startDate,
    activeProject.weeks,
    calculatedWeeks,
  ])
  const isScoreDurationInvalid = !isValidTimeInput(activeProject.scoreDuration)
  const gantt = useMemo(() => {
    const scheduledProjects = workspace.projects
      .map((project, index) => {
        const totalScoreSeconds = parseDurationToSeconds(project.scoreDuration)
        const autoPlannedSeconds = getDistributedPlannedSeconds(totalScoreSeconds, project.weeks, project.stages)
        const resolvedStart = getScheduleStartDate(project.startDate) ?? parseLocalDate(project.startDate)
        const resolvedEndValue =
          project.endDate || (project.startDate ? deriveAutoEndDate(project.startDate, project.weeks.length) : '')
        const resolvedEnd = parseLocalDate(resolvedEndValue)
        const weekSegments = deriveWeekSegments(project.startDate, resolvedEndValue) ?? []
        const totalWorkDays = project.weeks.reduce((sum, week) => {
          const planningMode = getStagePlanningMode(project.stages, week.stageId)
          const usesTimedPlanning = hasAssignedStage(project.stages, week.stageId) && planningMode === 'timed'
          return sum + (usesTimedPlanning ? week.days : 0)
        }, 0)

        if (!resolvedStart || !resolvedEnd || resolvedEnd < resolvedStart) {
          return null
        }

        const totalDays = Math.floor((resolvedEnd.getTime() - resolvedStart.getTime()) / DAY_MS) + 1
        let cursor = 0
        const segments = project.weeks.map((week, weekIndex) => {
          const spanDays = Math.max(1, weekSegments[weekIndex]?.calendarDays ?? week.days ?? 1)
          const stage = findStage(project.stages, week.stageId)
          const appearance = getStageAppearanceStyle(stage)
          const planningMode = getStagePlanningMode(project.stages, week.stageId)
          const usesTimedPlanning = hasAssignedStage(project.stages, week.stageId) && planningMode === 'timed'
          const plannedSeconds =
            usesTimedPlanning && (totalScoreSeconds > 0 || isValidTimeInput(week.planned))
              ? totalScoreSeconds > 0
                ? autoPlannedSeconds[weekIndex] ?? 0
                : parseDurationToSeconds(week.planned)
              : 0
          const actualSeconds =
            usesTimedPlanning && isValidTimeInput(week.actual) ? parseDurationToSeconds(week.actual) : 0
          const segmentStart = new Date(resolvedStart)
          segmentStart.setDate(segmentStart.getDate() + cursor)
          const segmentEnd = new Date(segmentStart)
          segmentEnd.setDate(segmentEnd.getDate() + spanDays - 1)
          const weekWidth = spanDays * ganttDayWidth
          const stageLabel = stage ? getStageDisplayName(stage, language) : '-'
          const weekLabelLong = language === 'zh' ? `第${weekIndex + 1}周` : `Week ${weekIndex + 1}`
          const weekLabelShort = language === 'zh' ? `周${weekIndex + 1}` : `W${weekIndex + 1}`
          const segment = {
            id: week.id,
            weekLabel:
              weekWidth >= 84 ? weekLabelLong : weekWidth >= 42 ? weekLabelShort : String(weekIndex + 1),
            stageLabel,
            rangeLabel: `${formatShortDate(segmentStart)} - ${formatShortDate(segmentEnd)}`,
            plannedTimeLabel: language === 'zh' ? `计 ${formatMinuteSecond(plannedSeconds)}` : `P ${formatMinuteSecond(plannedSeconds)}`,
            actualTimeLabel: language === 'zh' ? `实 ${formatMinuteSecond(actualSeconds)}` : `A ${formatMinuteSecond(actualSeconds)}`,
            deltaTimeLabel:
              language === 'zh'
                ? `差 ${actualSeconds - plannedSeconds > 0 ? '+' : actualSeconds - plannedSeconds < 0 ? '-' : ''}${formatMinuteSecond(Math.abs(actualSeconds - plannedSeconds))}`
                : `D ${actualSeconds - plannedSeconds > 0 ? '+' : actualSeconds - plannedSeconds < 0 ? '-' : ''}${formatMinuteSecond(Math.abs(actualSeconds - plannedSeconds))}`,
            timeTooltipLabel: formatPlannedActualTooltip(plannedSeconds, actualSeconds, language),
            plannedSeconds,
            actualSeconds,
            deltaSeconds: actualSeconds - plannedSeconds,
            mode: planningMode,
            appearance,
            offsetDays: cursor,
            spanDays,
            showTime: weekWidth >= 92 && ganttRowHeight >= 44 && usesTimedPlanning,
            showStage: weekWidth >= 104 && ganttRowHeight >= 56,
            showRange: weekWidth >= 112 && ganttRowHeight >= 56,
          }
          cursor += spanDays
          return segment
        })

        return {
          id: project.id,
          label: getProjectLabel(project, text, index),
          description: project.description.trim(),
          start: resolvedStart,
          end: resolvedEnd,
          averageDailySeconds:
            totalScoreSeconds > 0 && totalWorkDays > 0
              ? autoPlannedSeconds.reduce((sum, value) => sum + value, 0) / totalWorkDays
              : 0,
          totalDays,
          offsetDays: 0,
          segments,
          isActive: project.id === activeProject.id,
        }
      })
      .filter((project): project is NonNullable<typeof project> => Boolean(project))

    if (scheduledProjects.length === 0) {
      return {
        totalDays: 0,
        ticks: [] as Array<{
          label: string
          rangeLabel: string
          shortLabel: string
          offsetDays: number
          spanDays: number
          totalMinutesLabel: string
          totalMinutesShortLabel: string
          plannedSeconds: number
          actualSeconds: number
          deltaSeconds: number
        }>,
        monthTicks: [] as Array<{ label: string; offsetDays: number; spanDays: number; showLabel: boolean }>,
        todayOffsetDays: null as number | null,
        projects: [] as typeof scheduledProjects,
        unscheduledProjects: workspace.projects.filter((project) => !project.startDate || !project.endDate),
      }
    }

    const globalStart = scheduledProjects.reduce(
      (earliest, project) => (project.start < earliest ? project.start : earliest),
      scheduledProjects[0].start,
    )
    const globalEnd = scheduledProjects.reduce(
      (latest, project) => (project.end > latest ? project.end : latest),
      scheduledProjects[0].end,
    )
    const totalDays = Math.floor((globalEnd.getTime() - globalStart.getTime()) / DAY_MS) + 1
    const normalizedProjects = scheduledProjects.map((project) => ({
      ...project,
      offsetDays: Math.floor((project.start.getTime() - globalStart.getTime()) / DAY_MS),
    }))
    const ticks = Array.from({ length: Math.ceil(totalDays / 7) }, (_, index) => {
      const tickDate = new Date(globalStart)
      const offsetDays = index * 7
      const spanDays = Math.min(7, totalDays - offsetDays)
      tickDate.setDate(tickDate.getDate() + offsetDays)
      const totalPlannedSeconds = normalizedProjects.reduce((projectSum, project) => {
        const projectTickSum = project.segments.reduce((segmentSum, segment) => {
          const segmentStartDay = project.offsetDays + segment.offsetDays
          const segmentEndDay = segmentStartDay + segment.spanDays
          const tickEndDay = offsetDays + spanDays
          const overlapDays = Math.min(segmentEndDay, tickEndDay) - Math.max(segmentStartDay, offsetDays)

          if (overlapDays <= 0 || segment.plannedSeconds <= 0) {
            return segmentSum
          }

          return segmentSum + segment.plannedSeconds * (overlapDays / segment.spanDays)
        }, 0)

        return projectSum + projectTickSum
      }, 0)
      const totalActualSeconds = normalizedProjects.reduce((projectSum, project) => {
        const projectTickSum = project.segments.reduce((segmentSum, segment) => {
          const segmentStartDay = project.offsetDays + segment.offsetDays
          const segmentEndDay = segmentStartDay + segment.spanDays
          const tickEndDay = offsetDays + spanDays
          const overlapDays = Math.min(segmentEndDay, tickEndDay) - Math.max(segmentStartDay, offsetDays)

          if (overlapDays <= 0 || segment.actualSeconds <= 0) {
            return segmentSum
          }

          return segmentSum + segment.actualSeconds * (overlapDays / segment.spanDays)
        }, 0)

        return projectSum + projectTickSum
      }, 0)
      const totalDeltaSeconds = totalActualSeconds - totalPlannedSeconds

      return {
        label: formatShortDate(tickDate),
        rangeLabel: `${formatShortDate(tickDate)} - ${formatShortDate(new Date(tickDate.getFullYear(), tickDate.getMonth(), tickDate.getDate() + spanDays - 1))}`,
        shortLabel: formatShortDate(tickDate).replace('/', '.'),
        offsetDays,
        spanDays,
        totalMinutesLabel: formatPlannedActualTooltip(totalPlannedSeconds, totalActualSeconds, language),
        totalMinutesShortLabel: formatPlannedActualMinutesSummary(totalPlannedSeconds, totalActualSeconds, language),
        plannedSeconds: totalPlannedSeconds,
        actualSeconds: totalActualSeconds,
        deltaSeconds: totalDeltaSeconds,
      }
    })
    const monthTicks: Array<{ label: string; offsetDays: number; spanDays: number; showLabel: boolean }> = []
    const cursorDate = new Date(globalStart)
    cursorDate.setDate(1)

    while (cursorDate <= globalEnd) {
      const monthStart = new Date(
        Math.max(cursorDate.getTime(), globalStart.getTime()),
      )
      const monthEnd = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 0)
      const boundedMonthEnd = new Date(
        Math.min(monthEnd.getTime(), globalEnd.getTime()),
      )

      monthTicks.push({
        label: formatMonthHeader(monthStart, language),
        offsetDays: Math.floor((monthStart.getTime() - globalStart.getTime()) / DAY_MS),
        spanDays: Math.floor((boundedMonthEnd.getTime() - monthStart.getTime()) / DAY_MS) + 1,
        showLabel: Math.floor((boundedMonthEnd.getTime() - monthStart.getTime()) / DAY_MS) + 1 >= 4,
      })

      cursorDate.setMonth(cursorDate.getMonth() + 1)
      cursorDate.setDate(1)
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayOffsetDays =
      today >= globalStart && today <= globalEnd
        ? Math.floor((today.getTime() - globalStart.getTime()) / DAY_MS)
        : null

    return {
      totalDays,
      ticks,
      monthTicks,
      todayOffsetDays,
      projects: normalizedProjects,
      unscheduledProjects: workspace.projects.filter((project) => !project.startDate || !project.endDate),
    }
  }, [activeProject.id, ganttDayWidth, ganttRowHeight, language, text, workspace.projects])

  function updateProject(patch: Partial<Project>) {
    setWorkspace((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === current.activeProjectId
          ? (() => {
              let nextProject: Project = { ...project, ...patch }
              const scheduleMode = nextProject.scheduleMode

              if (Object.prototype.hasOwnProperty.call(patch, 'weeks')) {
                nextProject = {
                  ...nextProject,
                  weeks: resizeWeeks(nextProject.weeks, nextProject.weeks.length),
                }
              }

              if (Object.prototype.hasOwnProperty.call(patch, 'scheduleMode')) {
                nextProject = {
                  ...nextProject,
                  endDateMode: scheduleMode === 'week-driven' ? 'auto' : 'manual',
                }
                if (scheduleMode === 'week-driven' && nextProject.startDate) {
                  nextProject = {
                    ...nextProject,
                    endDate: deriveAutoEndDate(nextProject.startDate, nextProject.weeks.length),
                  }
                }
                if (scheduleMode === 'date-driven' && !nextProject.endDate && nextProject.startDate) {
                  nextProject = {
                    ...nextProject,
                    endDate: deriveAutoEndDate(nextProject.startDate, nextProject.weeks.length),
                  }
                }
              }

              if (Object.prototype.hasOwnProperty.call(patch, 'startDate') && !Object.prototype.hasOwnProperty.call(patch, 'endDate')) {
                if (scheduleMode === 'week-driven') {
                  nextProject = {
                    ...nextProject,
                    endDateMode: 'auto',
                    endDate: deriveAutoEndDate(nextProject.startDate, nextProject.weeks.length),
                  }
                }
              }

              if (Object.prototype.hasOwnProperty.call(patch, 'endDate')) {
                nextProject = {
                  ...nextProject,
                  endDateMode: scheduleMode === 'week-driven' ? 'auto' : patch.endDate ? 'manual' : 'auto',
                }
              }

              if (scheduleMode === 'week-driven' && nextProject.startDate) {
                nextProject = {
                  ...nextProject,
                  endDate: deriveAutoEndDate(nextProject.startDate, nextProject.weeks.length),
                }
              }

              const targetWeekDays = deriveWeekDays(nextProject.startDate, nextProject.endDate)
              if (targetWeekDays) {
                nextProject = {
                  ...nextProject,
                  weeks: applyDerivedWeekDays(
                    nextProject.weeks,
                    targetWeekDays,
                    scheduleMode !== 'date-driven',
                  ),
                }
              }

              return syncProjectSchedule(nextProject)
            })()
          : project,
      ),
    }))
  }

  function updateWeek(id: string, patch: Partial<WeekPlan>) {
    setWorkspace((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === current.activeProjectId
          ? {
              ...project,
              weeks: project.weeks.map((week) =>
                week.id === id
                  ? {
                      ...week,
                      ...patch,
                    }
                  : week,
              ),
            }
          : project,
      ),
    }))
  }

  function updateStage(stageId: string, patch: Partial<StageTemplate>) {
    setWorkspace((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === current.activeProjectId
          ? {
              ...project,
              stages: project.stages.map((stage) =>
                stage.id === stageId
                  ? {
                      ...stage,
                      ...patch,
                      name:
                        typeof patch.name === 'string' && patch.name.trim()
                          ? patch.name.trim()
                          : stage.name,
                      efficiency:
                        typeof patch.efficiency === 'number'
                          ? Math.max(0, Number(patch.efficiency.toFixed(1)))
                          : stage.efficiency,
                    }
                  : stage,
              ),
            }
          : project,
      ),
    }))
  }

  function addWeek() {
    const nextWeek = createWeek(activeProject.weeks.length)
    updateProject({ weeks: [...activeProject.weeks, nextWeek] })
  }

  function toggleStagePicker(weekId: string, triggerElement: HTMLButtonElement) {
    setActiveStagePickerWeekId((current) => {
      if (current === weekId) {
        activeStagePickerTriggerRef.current = null
        setActiveStagePopupPosition(null)
        return null
      }

      activeStagePickerTriggerRef.current = triggerElement
      return weekId
    })
  }

  function removeWeek(id: string) {
    if (activeProject.weeks.length === 1) {
      return
    }

    if (!window.confirm(text.deleteConfirm)) {
      return
    }

    updateProject({ weeks: activeProject.weeks.filter((week) => week.id !== id) })
  }

  function moveWeek(id: string, direction: 'up' | 'down') {
    const currentIndex = activeProject.weeks.findIndex((week) => week.id === id)
    if (currentIndex < 0) {
      return
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= activeProject.weeks.length) {
      return
    }

    const nextWeeks = [...activeProject.weeks]
    const [movedWeek] = nextWeeks.splice(currentIndex, 1)
    nextWeeks.splice(targetIndex, 0, movedWeek)
    updateProject({ weeks: nextWeeks })
  }

  function openStageCreator(sourceWeekId: string) {
    setActiveStagePickerWeekId(null)
    setStageEditor({
      mode: 'create',
      sourceWeekId,
      stageId: null,
      name: text.newStage,
      efficiency: '1.0',
      planningMode: 'timed',
      colorKey: 'sage',
    })
  }

  function openStageEditor(stageId: string) {
    const stage = findStage(activeProject.stages, stageId)
    if (!stage) {
      return
    }

    setActiveStagePickerWeekId(null)
    setStageEditor({
      mode: 'edit',
      sourceWeekId: null,
      stageId,
      name: getStageDisplayName(stage, language),
      efficiency: stage.efficiency.toFixed(1),
      planningMode: normalizeStagePlanningMode(stage.planningMode),
      colorKey: getResolvedStageColorKey(stage),
    })
  }

  function saveStageEditor() {
    if (!stageEditor) {
      return
    }

    const stageName =
      !stageEditor.name.trim() || isReservedEmptyStageName(stageEditor.name)
        ? text.newStage
        : stageEditor.name.trim()
    const efficiency = Math.max(0, Number(stageEditor.efficiency) || 1)
    const planningMode = stageEditor.planningMode
    const colorKey = normalizeStageColorKey(stageEditor.colorKey) ?? inferStageColorKey({
      id: stageEditor.stageId || '',
      name: stageName,
      efficiency,
      planningMode,
    })

    if (stageEditor.mode === 'edit' && stageEditor.stageId) {
      updateStage(stageEditor.stageId, { name: stageName, efficiency, planningMode, colorKey, isDefault: false })
      setStageEditor(null)
      return
    }

    const newStageId = createId('stage')
    const newStage: StageTemplate = {
      id: newStageId,
      name: ensureUniqueStageName(activeProject.stages, stageName, text),
      efficiency: Number(efficiency.toFixed(1)),
      planningMode,
      colorKey,
      isDefault: false,
    }

    updateProject({
      stages: [...activeProject.stages, newStage],
      weeks: activeProject.weeks.map((week) =>
        week.id === stageEditor.sourceWeekId
          ? { ...week, stageId: newStageId }
          : week,
      ),
    })
    setStageEditor(null)
  }

  function removeStage(stageId: string) {
    if (activeProject.stages.length <= 1) {
      window.alert(text.deleteLastStageAlert)
      return
    }

    if (!window.confirm(text.deleteStageConfirm)) {
      return
    }

    const remainingStages = activeProject.stages.filter((stage) => stage.id !== stageId)

    updateProject({
      stages: remainingStages,
      weeks: activeProject.weeks.map((week) =>
        week.stageId === stageId
          ? {
              ...week,
              stageId: '',
              planned: '00:00',
            }
          : week,
      ),
    })
    setStageEditor(null)
    setActiveStagePickerWeekId(null)
  }

  function createProject() {
    setIsProjectPickerOpen(false)
    setProjectEditor({
      mode: 'create',
      projectId: null,
      name: '',
    })
  }

  function openProjectEditor(projectId: string) {
    const project = workspace.projects.find((item) => item.id === projectId)
    if (!project) {
      return
    }

    setIsProjectPickerOpen(false)
    setProjectEditor({
      mode: 'edit',
      projectId,
      name: project.name,
    })
  }

  function saveProjectEditor() {
    if (!projectEditor) {
      return
    }

    const nextName = projectEditor.name.trim()

    if (projectEditor.mode === 'edit' && projectEditor.projectId) {
      setWorkspace((current) => ({
        ...current,
        projects: current.projects.map((project) =>
          project.id === projectEditor.projectId
            ? { ...project, name: nextName }
            : project,
        ),
      }))
      setProjectEditor(null)
      return
    }

    const newProject = {
      ...createDefaultProject(language),
      name: nextName,
    }

    setWorkspace((current) => ({
      projects: [...current.projects, newProject],
      activeProjectId: newProject.id,
    }))
    setProjectEditor(null)
  }

  function handleStageEditorKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
      return
    }

    event.preventDefault()
    saveStageEditor()
  }

  function handleProjectEditorKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
      return
    }

    event.preventDefault()
    saveProjectEditor()
  }

  function deleteProject(projectId: string) {
    if (!window.confirm(text.deleteProjectConfirm)) {
      return
    }

    setWorkspace((current) => {
      const remainingProjects = current.projects.filter((project) => project.id !== projectId)

      if (remainingProjects.length === 0) {
        const fallbackProject = createDefaultProject(language)
        return {
          projects: [fallbackProject],
          activeProjectId: fallbackProject.id,
        }
      }

      const nextActiveProjectId =
        current.activeProjectId === projectId
          ? remainingProjects[0].id
          : current.activeProjectId

      return {
        projects: remainingProjects,
        activeProjectId: nextActiveProjectId,
      }
    })

    setIsProjectPickerOpen(false)
  }

  function resetProject() {
    if (!window.confirm(text.resetConfirm)) {
      return
    }

    const resetProjectState = createDefaultProject(language)
    setWorkspace((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === current.activeProjectId
          ? { ...resetProjectState, id: project.id }
          : project,
      ),
    }))
    setActiveStagePickerWeekId(null)
    setStageEditor(null)
  }

  function exportCurrentProject() {
    const blob = new Blob([buildProjectCsv(activeProject)], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const projectIndex = workspace.projects.findIndex((project) => project.id === activeProject.id) + 1
    const baseName = `project-${projectIndex || 1}`
    link.href = url
    link.download = `${baseName}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportWorkspaceLibrary() {
    const payload = {
      format: 'weekly-score-planner-library',
      version: 1,
      exportedAt: new Date().toISOString(),
      workspace,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${sanitizeFileName(text.libraryExportName)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function exportCurrentViewImage() {
    const target = appShellRef.current
    if (!target || isExportingImage) {
      return
    }

    setIsExportingImage(true)
    setIsActionMenuOpen(false)

    try {
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)))
      const canvas = await html2canvas(target, {
        backgroundColor: '#111111',
        useCORS: true,
        scale: Math.min(window.devicePixelRatio || 1, 2),
        width: target.scrollWidth,
        height: target.scrollHeight,
        windowWidth: Math.max(window.innerWidth, target.scrollWidth),
        windowHeight: Math.max(window.innerHeight, target.scrollHeight),
        scrollX: 0,
        scrollY: 0,
      })

      const link = document.createElement('a')
      const projectName = sanitizeFileName(activeProject.name || activeProject.description || text.projectName)
      link.href = canvas.toDataURL('image/png')
      link.download = `${projectName}-planner.png`
      link.click()
    } finally {
      setIsExportingImage(false)
    }
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const content = await file.text()
    const importedProject = importProjectFromCsv(content, language)
    if (!importedProject) {
      window.alert(text.invalidCsv)
      event.target.value = ''
      return
    }

    const conflict = workspace.projects.find((project) =>
      (importedProject.name.trim() && project.name.trim() === importedProject.name.trim()) ||
      getProjectSignature(project) === getProjectSignature(importedProject),
    )

    if (conflict) {
      setImportConflict({
        existingProjectId: conflict.id,
        importedProject,
      })
      event.target.value = ''
      return
    }

    setWorkspace((current) => ({
      projects: [...current.projects, importedProject],
      activeProjectId: importedProject.id,
    }))
    setActiveStagePickerWeekId(null)
    setStageEditor(null)
    setIsProjectPickerOpen(false)
    event.target.value = ''
  }

  async function handleLibraryImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const content = await file.text()
    const importedWorkspace = importWorkspaceFromJson(content, language)
    if (!importedWorkspace) {
      window.alert(text.invalidLibrary)
      event.target.value = ''
      return
    }

    if (!window.confirm(text.importLibraryConfirm)) {
      event.target.value = ''
      return
    }

    setWorkspace(importedWorkspace)
    setActiveStagePickerWeekId(null)
    setStageEditor(null)
    setIsProjectPickerOpen(false)
    setImportConflict(null)
    event.target.value = ''
  }

  function overwriteImportedProject() {
    if (!importConflict) {
      return
    }

    setWorkspace((current) => ({
      projects: current.projects.map((project) =>
        project.id === importConflict.existingProjectId
          ? { ...importConflict.importedProject, id: project.id }
          : project,
      ),
      activeProjectId: importConflict.existingProjectId,
    }))
    setImportConflict(null)
    setIsProjectPickerOpen(false)
  }

  function keepBothImportedProject() {
    if (!importConflict) {
      return
    }

    setWorkspace((current) => ({
      projects: [...current.projects, importConflict.importedProject],
      activeProjectId: importConflict.importedProject.id,
    }))
    setImportConflict(null)
    setIsProjectPickerOpen(false)
  }

  async function handleAuthSubmit(mode: 'sign-in' | 'sign-up') {
    if (!supabase) {
      return
    }

    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthMessage(language === 'zh' ? '请先输入邮箱和密码。' : 'Enter your email and password first.')
      return
    }

    setIsAuthSubmitting(true)
    setAuthMessage('')

    try {
      if (mode === 'sign-up') {
        const { error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
        })

        if (error) {
          throw error
        }

        setIsAwaitingEmailConfirmation(true)
        setAuthPassword('')
        setAuthMessage(text.authCheckEmail)
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        })

        if (error) {
          throw error
        }
      }
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Authentication failed.')
    } finally {
      setIsAuthSubmitting(false)
    }
  }

  async function handleSignOut() {
    if (!supabase) {
      return
    }

    await supabase.auth.signOut()
    setAuthSession(null)
    setIsCloudWorkspaceReady(false)
    setSyncStatus('idle')
    setCloudWorkspaceName('')
    setCloudWorkspaceRole('')
    setInviteEmail('')
    setInviteMessage('')
    setWorkspaceMembers([])
    setMemberActionMessage('')
  }

  async function handleInviteMember() {
    if (!inviteEmail.trim()) {
      setInviteMessage(language === 'zh' ? '请先输入队友邮箱。' : 'Enter a teammate email first.')
      return
    }

    setIsInviteSubmitting(true)
    setInviteMessage('')

    try {
      await inviteWorkspaceMember(inviteEmail)
      setInviteEmail('')
      setInviteMessage(text.workspaceInviteSent)
      await refreshWorkspaceMembers()
    } catch (error) {
      setInviteMessage(error instanceof Error ? error.message : language === 'zh' ? '邀请失败。' : 'Invite failed.')
    } finally {
      setIsInviteSubmitting(false)
    }
  }

  async function refreshWorkspaceMembers() {
    if (!authSession) {
      setWorkspaceMembers([])
      return
    }

    setIsWorkspaceMembersLoading(true)

    try {
      const response = await listWorkspaceMembers()
      setCloudWorkspaceName(response.workspaceName)
      setCloudWorkspaceRole(response.role)
      setWorkspaceMembers(response.members)
    } catch (error) {
      setMemberActionMessage(error instanceof Error ? error.message : language === 'zh' ? '加载成员失败。' : 'Failed to load members.')
    } finally {
      setIsWorkspaceMembersLoading(false)
    }
  }

  async function handleRemoveMember(memberId: string) {
    setRemovingMemberId(memberId)
    setMemberActionMessage('')

    try {
      await removeWorkspaceMember(memberId)
      await refreshWorkspaceMembers()
    } catch (error) {
      setMemberActionMessage(error instanceof Error ? error.message : language === 'zh' ? '移除成员失败。' : 'Failed to remove member.')
    } finally {
      setRemovingMemberId(null)
    }
  }

  async function handleMemberRoleChange(memberId: string, role: 'editor' | 'viewer') {
    setUpdatingMemberId(memberId)
    setMemberActionMessage('')

    try {
      await updateWorkspaceMemberRole(memberId, role)
      await refreshWorkspaceMembers()
    } catch (error) {
      setMemberActionMessage(error instanceof Error ? error.message : language === 'zh' ? '更新角色失败。' : 'Failed to update role.')
    } finally {
      setUpdatingMemberId(null)
    }
  }

  const syncStatusLabel =
    syncStatus === 'syncing'
      ? text.authSyncing
      : syncStatus === 'error'
      ? text.authSyncError
      : syncStatus === 'synced'
      ? text.authSynced
      : ''
  const workspaceRoleLabel =
    cloudWorkspaceRole === 'owner'
      ? text.workspaceRoleOwner
      : cloudWorkspaceRole === 'editor'
      ? text.workspaceRoleEditor
      : cloudWorkspaceRole === 'viewer'
      ? text.workspaceRoleViewer
      : ''

  return (
    <main
      ref={appShellRef}
      className={`app-shell ${isTooltipModifierActive ? 'app-shell--tooltip-active' : ''}`.trim()}
    >
      <input
        ref={libraryInputRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        onChange={handleLibraryImport}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={handleImport}
      />

      {!isSupabaseConfigured ? (
        <section className="auth-shell">
          <div className="auth-card">
            <p className="panel-kicker">Supabase</p>
            <h1>{text.authSetupTitle}</h1>
            <p className="hero-copy">{text.authSetupCopy}</p>
            <div className="auth-meta">
              <code>VITE_SUPABASE_URL=https://thrqknbbrvkzsawjmhei.supabase.co</code>
              <code>VITE_SUPABASE_ANON_KEY=...</code>
            </div>
          </div>
        </section>
      ) : isAuthLoading ? (
        <section className="auth-shell">
          <div className="auth-card">
            <p className="panel-kicker">Supabase</p>
            <h1>{text.authLoading}</h1>
          </div>
        </section>
      ) : !authSession ? (
        <section className="auth-shell">
          <div className="auth-card">
            <p className="panel-kicker">Supabase</p>
            {isAwaitingEmailConfirmation ? (
              <>
                <h1>{text.authConfirmTitle}</h1>
                <p className="hero-copy">{text.authConfirmCopy}</p>
                <div className="auth-meta">
                  <code>{authEmail.trim()}</code>
                </div>
                <div className="auth-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      setIsAwaitingEmailConfirmation(false)
                      setAuthMessage('')
                    }}
                  >
                    {text.authConfirmBack}
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setIsAwaitingEmailConfirmation(false)
                      setAuthEmail('')
                      setAuthPassword('')
                      setAuthMessage('')
                    }}
                  >
                    {text.authConfirmUseAnother}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h1>{text.authTitle}</h1>
                <p className="hero-copy">{text.authCopy}</p>
                <div className="auth-form">
                  <label className="field">
                    <span>{text.authEmail}</span>
                    <input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} type="email" />
                  </label>
                  <label className="field">
                    <span>{text.authPassword}</span>
                    <input value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} type="password" />
                  </label>
                  <label className="auth-remember">
                    <input
                      type="checkbox"
                      checked={rememberAuth}
                      onChange={(event) => {
                        const nextValue = event.target.checked
                        setRememberAuth(nextValue)
                        if (!nextValue) {
                          setAuthPassword('')
                        }
                      }}
                    />
                    <span>{text.authRemember}</span>
                  </label>
                  {authMessage ? <div className="summary-warning summary-warning--inline auth-message">{authMessage}</div> : null}
                  <div className="auth-actions">
                    <button type="button" className="primary-button" onClick={() => void handleAuthSubmit('sign-in')} disabled={isAuthSubmitting}>
                      {text.authSignIn}
                    </button>
                    <button type="button" className="ghost-button" onClick={() => void handleAuthSubmit('sign-up')} disabled={isAuthSubmitting}>
                      {text.authSignUp}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      ) : !isCloudWorkspaceReady ? (
        <section className="auth-shell">
          <div className="auth-card">
            <p className="panel-kicker">Supabase</p>
            <h1>{text.authSyncing}</h1>
          </div>
        </section>
      ) : (
      <section
        className={`workspace-grid ${viewMode === 'gantt' ? 'workspace-grid--gantt' : ''} ${
          isSummaryCollapsed ? 'workspace-grid--summary-collapsed' : ''
        }`.trim()}
      >
        <div className="main-column">
          <section className="hero-panel">
            <div>
              <p className="eyebrow">Awakening Studios</p>
              <h1 className="hero-title">{text.heroTitle}</h1>
              <p className="hero-copy">{text.heroCopy}</p>
            </div>

            <div className="hero-actions">
              <div className="language-toggle" aria-label={text.language}>
                <button
                  type="button"
                  className={
                    language === 'en'
                      ? 'language-button language-button--active'
                      : 'language-button'
                  }
                  onClick={() => setLanguage('en')}
                >
                  EN
                </button>
                <button
                  type="button"
                  className={
                    language === 'zh'
                      ? 'language-button language-button--active'
                      : 'language-button'
                  }
                  onClick={() => setLanguage('zh')}
                >
                  中
                </button>
              </div>

              <div className="action-menu-wrapper">
                <button
                  type="button"
                  className="ghost-button ghost-button--small"
                  onClick={() => setIsActionMenuOpen((current) => !current)}
                  aria-expanded={isActionMenuOpen}
                  aria-haspopup="true"
                >
                  {text.menu}
                </button>

                {isActionMenuOpen ? (
                  <div className="action-menu" role="menu">
                    <div className="action-menu-header">
                      <span className="action-menu-label">{text.menuTitle}</span>
                      <button
                        type="button"
                        className="popup-close-button"
                        onClick={() => setIsActionMenuOpen(false)}
                        aria-label={text.closeMenu}
                      >
                        ×
                      </button>
                    </div>
                    <div className="action-menu-section">
                      <span className="action-menu-section-label">{text.menuAccount}</span>
                    </div>
                    <div className="action-menu-account">
                      <span>{text.authLoggedInAs}</span>
                      <strong>{authSession.user.email ?? authSession.user.id}</strong>
                      {cloudWorkspaceName ? (
                        <span>{`${text.workspaceLabel}: ${cloudWorkspaceName}`}</span>
                      ) : null}
                      {workspaceRoleLabel ? (
                        <span>{`${text.workspaceRole}: ${workspaceRoleLabel}`}</span>
                      ) : null}
                      {syncStatusLabel ? <em>{syncStatusLabel}</em> : null}
                      {syncStatus === 'error' && authMessage ? <small>{authMessage}</small> : null}
                      <button
                        type="button"
                        className="action-menu-inline-button"
                        onClick={() => void handleSignOut()}
                      >
                        {text.authSignOut}
                      </button>
                    </div>
                    <div className="action-menu-section">
                      <span className="action-menu-section-label">{text.menuTeam}</span>
                    </div>
                    <div className="action-menu-team">
                      <p className="action-menu-help">
                        {cloudWorkspaceName
                          ? `${text.workspaceLabel}: ${cloudWorkspaceName}`
                          : text.workspaceOwnerOnly}
                      </p>
                      <button
                        type="button"
                        className="action-menu-button"
                        onClick={() => {
                          setIsActionMenuOpen(false)
                          setIsTeamManagerOpen(true)
                          void refreshWorkspaceMembers()
                        }}
                      >
                        {text.manageTeam}
                      </button>
                    </div>
                    <div className="action-menu-section">
                      <span className="action-menu-section-label">{text.menuLibrary}</span>
                    </div>
                    <div className="action-menu-group">
                      <div className="action-menu-folder">
                        <button
                          type="button"
                          className="action-menu-button action-menu-button--folder"
                        >
                          {text.menuImport}
                        </button>
                        <div className="action-submenu" role="menu">
                          <button
                            type="button"
                            className="action-menu-button action-menu-button--nested"
                            onClick={() => {
                              setIsActionMenuOpen(false)
                              libraryInputRef.current?.click()
                            }}
                          >
                            {text.importLibrary}
                          </button>
                          <button
                            type="button"
                            className="action-menu-button action-menu-button--nested"
                            onClick={() => {
                              setIsActionMenuOpen(false)
                              fileInputRef.current?.click()
                            }}
                          >
                            {text.importCsv}
                          </button>
                        </div>
                      </div>

                      <div className="action-menu-folder">
                        <button
                          type="button"
                          className="action-menu-button action-menu-button--folder"
                        >
                          {text.menuExport}
                        </button>
                        <div className="action-submenu" role="menu">
                          <button
                            type="button"
                            className="action-menu-button action-menu-button--nested"
                            onClick={() => {
                              setIsActionMenuOpen(false)
                              exportWorkspaceLibrary()
                            }}
                          >
                            {text.exportLibrary}
                          </button>
                          <button
                            type="button"
                            className="action-menu-button action-menu-button--nested"
                            onClick={() => {
                              setIsActionMenuOpen(false)
                              exportCurrentProject()
                            }}
                          >
                            {text.exportCsv}
                          </button>
                          <button
                            type="button"
                            className="action-menu-button action-menu-button--nested"
                            onClick={() => {
                              setIsActionMenuOpen(false)
                              void exportCurrentViewImage()
                            }}
                            disabled={isExportingImage}
                          >
                            {isExportingImage ? text.exportingImage : text.exportImage}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="action-menu-section action-menu-section--danger">
                      <span className="action-menu-section-label">{text.menuDanger}</span>
                    </div>
                    <div className="action-menu-group action-menu-group--danger">
                      <button
                        type="button"
                        className="action-menu-button action-menu-button--danger"
                        onClick={resetProject}
                      >
                        {text.resetDefault}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="content-grid">
            <article className="panel project-toolbar">
              <div className="project-toolbar-inner">
                <div className="project-picker">
                  <span className="project-toolbar-label">{text.projects}</span>
                  <button
                    type="button"
                    className="project-trigger"
                    onClick={() => setIsProjectPickerOpen((current) => !current)}
                  >
                    {getProjectLabel(activeProject, text, workspace.projects.findIndex((project) => project.id === activeProject.id))}
                  </button>

                  {isProjectPickerOpen ? (
                    <div className="project-popup">
                      {workspace.projects.map((project, index) => (
                        <div key={project.id} className="project-popup-row">
                          <button
                            type="button"
                            className={`stage-option ${
                              project.id === activeProject.id ? 'stage-option--active' : ''
                            }`}
                            onClick={() => {
                              setWorkspace((current) => ({
                                ...current,
                                activeProjectId: project.id,
                              }))
                              setIsProjectPickerOpen(false)
                            }}
                          >
                            <span className="stage-option-name">
                              {getProjectLabel(project, text, index)}
                            </span>
                          </button>

                          <button
                            type="button"
                            className="stage-edit-button"
                            onClick={() => openProjectEditor(project.id)}
                            aria-label={`${text.editProjectAria} ${getProjectLabel(project, text, index)}`}
                          >
                            ✎
                          </button>

                          <button
                            type="button"
                            className="stage-edit-button"
                            onClick={() => deleteProject(project.id)}
                            aria-label={`${text.deleteProjectAria} ${getProjectLabel(project, text, index)}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        className="stage-add-button"
                        onClick={createProject}
                      >
                        {text.addNewProject}
                      </button>
                    </div>
                  ) : null}
                </div>

                <label className="field project-description-group">
                  <span>{text.projectDescription}</span>
                  <textarea
                    value={activeProject.description}
                    onChange={(event) => updateProject({ description: event.target.value })}
                  />
                </label>
              </div>

            </article>

            <article className="panel table-panel">
              <div className="panel-header">
                <div>
                  <p className="panel-kicker">
                    {viewMode === 'list' ? text.weeklyPlanKicker : text.ganttView}
                  </p>
                  <h2>{viewMode === 'list' ? text.weeklyPlan : text.ganttTitle}</h2>
                  {viewMode === 'gantt' ? <p className="hero-copy">{text.ganttCopy}</p> : null}
                </div>
                <div className="view-toggle" aria-label="View mode">
                  <button
                    type="button"
                    className={viewMode === 'list' ? 'view-toggle-button view-toggle-button--active' : 'view-toggle-button'}
                    onClick={() => setViewMode('list')}
                  >
                    {text.listView}
                  </button>
                  <button
                    type="button"
                    className={viewMode === 'gantt' ? 'view-toggle-button view-toggle-button--active' : 'view-toggle-button'}
                    onClick={() => setViewMode('gantt')}
                  >
                    {text.ganttView}
                  </button>
                </div>
              </div>

              {viewMode === 'list' ? (
                <>
                  {summary.hasUnassignedStages ? (
                    <div className="summary-warning summary-warning--inline table-warning">
                      {text.summaryStageWarning}
                    </div>
                  ) : null}

                  <div className="table-wrap">
                    <table>
                      <colgroup>
                        <col className="col-week" />
                        <col className="col-range" />
                        <col className="col-stage" />
                        <col className="col-days" />
                        <col className="col-planned" />
                        <col className="col-actual" />
                        <col className="col-variance" />
                        <col className="col-notes" />
                        <col className="col-action" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>{text.index}</th>
                          <th>{text.weekRange}</th>
                          <th>{text.stage}</th>
                          <th>{text.days}</th>
                          <th>{text.planned}</th>
                          <th>{text.actual}</th>
                          <th>{text.delta}</th>
                          <th>{text.notes}</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {calculatedWeeks.map((week) => {
                          const isPlannedInvalid = week.usesTimedPlanning && !isValidTimeInput(week.plannedValue)
                          const isActualInvalid = week.usesTimedPlanning && !isValidTimeInput(week.actual)
                          const assignedStage = findStage(activeProject.stages, week.stageId)
                          const stageAppearance = getStageAppearanceStyle(assignedStage)

                          return (
                            <tr
                              key={week.id}
                              className={[
                                timeline.currentWeekIndex !== null && week.index - 1 <= timeline.currentWeekIndex
                                  ? 'week-row--active-line'
                                  : '',
                                week.index === 1 ? 'week-row--first' : '',
                                timeline.currentWeekIndex === week.index - 1 ? 'week-row--current' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            >
                              <td className="week-label">
                                <span className="week-cell">
                                  <span className="week-timeline">
                                    <span className="week-timeline-line" />
                                    {timeline.currentWeekIndex === week.index - 1 ? (
                                      <span className="week-timeline-node">▸</span>
                                    ) : summary.hasScheduleMismatch &&
                                      week.index >= summary.overflowWeekStart ? (
                                      <span
                                        className="warning-icon warning-icon--inline"
                                        data-tooltip={text.warningOverflowWeek}
                                        aria-label={text.warningOverflowWeek}
                                      >
                                        !
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="week-label-text">{week.weekLabel}</span>
                                </span>
                              </td>
                              <td className="range-label">
                                <div className="range-label-stack">
                                  <span>{week.rangeLabel}</span>
                                </div>
                              </td>
                              <td>
                                <div className="stage-picker">
                                  <button
                                    type="button"
                                    className={`stage-trigger ${week.hasAssignedStage ? '' : 'stage-trigger--warning'}`.trim()}
                                    style={week.hasAssignedStage ? stageAppearance : undefined}
                                    onClick={(event) => toggleStagePicker(week.id, event.currentTarget)}
                                    aria-label={week.hasAssignedStage ? week.stageName : text.stageNeedsAssignmentHelp}
                                    title={week.hasAssignedStage ? undefined : text.stageNeedsAssignmentHelp}
                                  >
                                    {week.stageName}
                                  </button>
                                  {!week.hasAssignedStage ? (
                                    <span
                                      className="warning-icon stage-warning-icon"
                                      data-tooltip={text.stageNeedsAssignmentHelp}
                                      aria-label={text.stageNeedsAssignmentHelp}
                                    >
                                      !
                                    </span>
                                  ) : null}

                                  {activeStagePickerWeekId === week.id ? (
                                    <div
                                      className={`stage-popup ${activeStagePickerPlacement === 'up' ? 'stage-popup--up' : ''}`}
                                      style={
                                        activeStagePopupPosition
                                          ? {
                                              top: `${activeStagePopupPosition.top}px`,
                                              left: `${activeStagePopupPosition.left}px`,
                                              width: `${activeStagePopupPosition.width}px`,
                                              maxHeight: `${activeStagePopupPosition.maxHeight}px`,
                                            }
                                          : undefined
                                      }
                                    >
                                      {activeProject.stages.map((stage) => (
                                        <div key={stage.id} className="stage-popup-row">
                                          <button
                                            type="button"
                                            className={`stage-option ${
                                              stage.id === week.stageId ? 'stage-option--active' : ''
                                            }`}
                                            onClick={() => {
                                              updateWeek(week.id, {
                                                stageId: stage.id,
                                                planned: activeProject.scoreDuration.trim()
                                                  ? week.planned
                                                  : '',
                                              })
                                              activeStagePickerTriggerRef.current = null
                                              setActiveStagePopupPosition(null)
                                              setActiveStagePickerWeekId(null)
                                            }}
                                          >
                                            <span
                                              className="stage-option-color"
                                              style={getStageAppearanceStyle(stage)}
                                              aria-hidden="true"
                                            />
                                            <span className="stage-option-name">
                                              {getStageName(activeProject.stages, stage.id, language)}
                                            </span>
                                            <span className="stage-option-efficiency">
                                              {stage.planningMode === 'schedule-only'
                                                ? '—'
                                                : stage.efficiency.toFixed(1)}
                                            </span>
                                          </button>

                                          <button
                                            type="button"
                                            className="stage-edit-button"
                                            onClick={() => openStageEditor(stage.id)}
                                            aria-label={`${text.editStageAria} ${getStageName(activeProject.stages, stage.id, language)}`}
                                          >
                                            ✎
                                          </button>

                                          <button
                                            type="button"
                                            className="stage-edit-button"
                                            onClick={() => removeStage(stage.id)}
                                            aria-label={`${text.deleteStageAria} ${getStageName(activeProject.stages, stage.id, language)}`}
                                          >
                                            ×
                                          </button>
                                        </div>
                                      ))}

                                      <button
                                        type="button"
                                        className="stage-add-button"
                                        onClick={() => openStageCreator(week.id)}
                                      >
                                        {text.addNewStage}
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              </td>

                              <td>
                                <div className="day-input-wrap">
                                  <input
                                    type="number"
                                    min="1"
                                    max="7"
                                    value={week.days}
                                    disabled={activeProject.scheduleMode === 'date-driven'}
                                    onChange={(event) =>
                                      updateWeek(week.id, {
                                        days: Math.max(1, Math.min(7, Number(event.target.value) || 1)),
                                      })
                                    }
                                  />
                                </div>
                              </td>

                              <td>
                                <input
                                  className={`time-input mono ${isPlannedInvalid ? 'time-input--invalid' : ''}`.trim()}
                                  value={week.plannedValue}
                                  readOnly={Boolean(activeProject.scoreDuration.trim()) || !week.usesTimedPlanning}
                                  onBlur={
                                    activeProject.scoreDuration.trim() || !week.usesTimedPlanning
                                      ? undefined
                                      : (event) =>
                                          handleTimeCommit(event, (value) =>
                                            updateWeek(week.id, {
                                              planned: value,
                                            }),
                                          )
                                  }
                                  onKeyDown={
                                    activeProject.scoreDuration.trim() || !week.usesTimedPlanning
                                      ? undefined
                                      : (event) =>
                                          handleTimeKeyDown(event, (value) =>
                                            updateWeek(week.id, {
                                              planned: value,
                                            }),
                                          )
                                  }
                                  onChange={
                                    activeProject.scoreDuration.trim() || !week.usesTimedPlanning
                                      ? undefined
                                      : (event) =>
                                          handleTimeDraftChange(event, (value) =>
                                            updateWeek(week.id, {
                                              planned: value,
                                            }),
                                          )
                                  }
                                  placeholder={week.usesTimedPlanning ? '00:00' : '--'}
                                  inputMode="numeric"
                                  aria-invalid={isPlannedInvalid}
                                  title={isPlannedInvalid ? text.timeFormatInvalid : undefined}
                                />
                              </td>

                              <td>
                                <input
                                  className={`time-input mono ${isActualInvalid ? 'time-input--invalid' : ''}`.trim()}
                                  value={week.usesTimedPlanning ? week.actual : ''}
                                  onBlur={(event) => {
                                    if (!week.usesTimedPlanning) {
                                      return
                                    }

                                    handleTimeCommit(event, (value) =>
                                      updateWeek(week.id, {
                                        actual: value,
                                      }),
                                    )
                                  }}
                                  onKeyDown={(event) => {
                                    if (!week.usesTimedPlanning) {
                                      return
                                    }

                                    handleTimeKeyDown(event, (value) =>
                                      updateWeek(week.id, {
                                        actual: value,
                                      }),
                                    )
                                  }}
                                  onChange={(event) => {
                                    if (!week.usesTimedPlanning) {
                                      return
                                    }

                                    handleTimeDraftChange(event, (value) =>
                                      updateWeek(week.id, {
                                        actual: value,
                                      }),
                                    )
                                  }}
                                  readOnly={!week.usesTimedPlanning}
                                  placeholder={week.usesTimedPlanning ? '00:00' : '--'}
                                  inputMode="numeric"
                                  aria-invalid={isActualInvalid}
                                  title={isActualInvalid ? text.timeFormatInvalid : undefined}
                                />
                              </td>

                              <td className="mono variance">
                                {!week.hasActual
                                  ? '-'
                                  : `${week.varianceSeconds > 0 ? '+' : week.varianceSeconds < 0 ? '-' : ''}${formatMinuteSecond(
                                      Math.abs(week.varianceSeconds),
                                    )}`}
                              </td>

                              <td>
                                <input
                                  value={week.notes}
                                  onChange={(event) =>
                                    updateWeek(week.id, { notes: event.target.value })
                                  }
                                />
                              </td>

                              <td>
                                <div className="row-actions">
                                  <button
                                    type="button"
                                    className="table-icon-button"
                                    onClick={() => moveWeek(week.id, 'up')}
                                    aria-label={`${text.moveWeekUpAria} ${week.index}`}
                                    title={text.moveWeekUp}
                                    disabled={week.index === 1}
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    className="table-icon-button"
                                    onClick={() => moveWeek(week.id, 'down')}
                                    aria-label={`${text.moveWeekDownAria} ${week.index}`}
                                    title={text.moveWeekDown}
                                    disabled={week.index === calculatedWeeks.length}
                                  >
                                    ↓
                                  </button>
                                  <button
                                    type="button"
                                    className="table-icon-button table-icon-button--danger"
                                    onClick={() => removeWeek(week.id)}
                                    aria-label={`${text.delete} ${week.index}`}
                                    title={text.delete}
                                    disabled={activeProject.scheduleMode === 'date-driven'}
                                  >
                                    ×
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="table-footer">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={addWeek}
                      disabled={activeProject.scheduleMode === 'date-driven'}
                      title={activeProject.scheduleMode === 'date-driven' ? text.scheduleModeHelp : undefined}
                    >
                      {text.addWeek}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="gantt-legend">
                    <span className="gantt-legend-item">
                      <span className="gantt-legend-swatch gantt-legend-swatch--writing" />
                      {text.ganttWriting}
                    </span>
                    <span className="gantt-legend-item">
                      <span className="gantt-legend-swatch gantt-legend-swatch--schedule" />
                      {text.ganttSchedule}
                    </span>
                    <div className="gantt-zoom-panel" aria-label={text.ganttZoom}>
                      <span className="gantt-zoom-label">{text.ganttZoom}</span>
                      <div className="gantt-zoom-set">
                        <span className="gantt-zoom-key">H</span>
                        <div className="gantt-zoom-controls">
                          <button
                            type="button"
                            className="table-icon-button"
                            onClick={() =>
                              setGanttHorizontalZoomIndex((current) =>
                                clampIndex(current - 1, GANTT_HORIZONTAL_ZOOMS.length),
                              )
                            }
                            disabled={ganttHorizontalZoomIndex === 0}
                            title={text.ganttHorizontalZoom}
                          >
                            -
                          </button>
                          <button
                            type="button"
                            className="table-icon-button"
                            onClick={() =>
                              setGanttHorizontalZoomIndex((current) =>
                                clampIndex(current + 1, GANTT_HORIZONTAL_ZOOMS.length),
                              )
                            }
                            disabled={ganttHorizontalZoomIndex === GANTT_HORIZONTAL_ZOOMS.length - 1}
                            title={text.ganttHorizontalZoom}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="gantt-zoom-set">
                        <span className="gantt-zoom-key">V</span>
                        <div className="gantt-zoom-controls">
                          <button
                            type="button"
                            className="table-icon-button"
                            onClick={() =>
                              setGanttVerticalZoomIndex((current) =>
                                clampIndex(current - 1, GANTT_VERTICAL_ZOOMS.length),
                              )
                            }
                            disabled={ganttVerticalZoomIndex === 0}
                            title={text.ganttVerticalZoom}
                          >
                            -
                          </button>
                          <button
                            type="button"
                            className="table-icon-button"
                            onClick={() =>
                              setGanttVerticalZoomIndex((current) =>
                                clampIndex(current + 1, GANTT_VERTICAL_ZOOMS.length),
                              )
                            }
                            disabled={ganttVerticalZoomIndex === GANTT_VERTICAL_ZOOMS.length - 1}
                            title={text.ganttVerticalZoom}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {gantt.projects.length > 0 ? (
                    <div
                      className="gantt-layout"
                      style={{
                        ['--gantt-days' as string]: String(gantt.totalDays),
                        ['--gantt-day-width' as string]: `${ganttDayWidth}px`,
                        ['--gantt-row-height' as string]: `${ganttRowHeight}px`,
                        ['--gantt-label-width' as string]: '220px',
                        ['--gantt-column-gap' as string]: '12px',
                      }}
                    >
                      <div className="gantt-sidebar">
                        <div className="gantt-sidebar-header">
                          <div className="gantt-project-cell gantt-project-cell--month-spacer" />
                          <div className="gantt-project-cell gantt-project-cell--header-controls">
                            <div className="gantt-mode-toggle" role="tablist" aria-label="Gantt time mode">
                              <button
                                type="button"
                                className={`gantt-mode-button ${ganttTimeMode === 'planned' ? 'gantt-mode-button--active' : ''}`.trim()}
                                onClick={() => setGanttTimeMode('planned')}
                                aria-pressed={ganttTimeMode === 'planned'}
                              >
                                {text.ganttPlannedShort}
                              </button>
                              <button
                                type="button"
                                className={`gantt-mode-button ${ganttTimeMode === 'actual' ? 'gantt-mode-button--active' : ''}`.trim()}
                                onClick={() => setGanttTimeMode('actual')}
                                aria-pressed={ganttTimeMode === 'actual'}
                              >
                                {text.ganttActualShort}
                              </button>
                              <button
                                type="button"
                                className={`gantt-mode-button ${ganttTimeMode === 'delta' ? 'gantt-mode-button--active' : ''}`.trim()}
                                onClick={() => setGanttTimeMode('delta')}
                                aria-pressed={ganttTimeMode === 'delta'}
                              >
                                {text.ganttDeltaShort}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="gantt-sidebar-projects">
                          {gantt.projects.map((project) => (
                            <button
                              key={project.id}
                              type="button"
                              className={`gantt-project-cell ${
                                ganttRowHeight <= 32 ? 'gantt-project-cell--compact' : ''
                              } ${project.isActive ? 'gantt-project-cell--active' : ''}`.trim()}
                              onClick={() =>
                                setWorkspace((current) => ({
                                  ...current,
                                  activeProjectId: project.id,
                                }))
                              }
                            >
                              <strong>{project.label}</strong>
                              {ganttRowHeight > 24 ? (
                                <span>{`${formatShortDate(project.start)} - ${formatShortDate(project.end)}`}</span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="gantt-scroll">
                        <div className="gantt-board">
                          {typeof gantt.todayOffsetDays === 'number' ? (
                            <div
                              className="gantt-today-line"
                              style={{
                                left: `${gantt.todayOffsetDays * ganttDayWidth}px`,
                              }}
                            >
                              <span className="gantt-today-dot" />
                            </div>
                          ) : null}

                          <div className="gantt-header-timeline">
                            <div className="gantt-month-row">
                              {gantt.monthTicks.map((tick) => (
                                <div
                                  key={`${tick.label}-${tick.offsetDays}`}
                                  className="gantt-month-tick"
                                  style={{
                                    left: `${tick.offsetDays * ganttDayWidth}px`,
                                    width: `${Math.max(tick.spanDays * ganttDayWidth, ganttDayWidth)}px`,
                                  }}
                                >
                                  {tick.showLabel ? <span>{tick.label}</span> : null}
                                </div>
                              ))}
                            </div>
                            <div className="gantt-week-summary-row">
                              {gantt.ticks.map((tick, index) => (
                                <div
                                  key={tick.offsetDays}
                                  className="gantt-week-summary-card"
                                  data-tooltip={
                                    language === 'zh'
                                      ? `第${index + 1}周 · ${tick.label} · ${tick.totalMinutesLabel}`
                                      : `Week ${index + 1} · ${tick.label} · ${tick.totalMinutesLabel}`
                                  }
                                  style={{
                                    left: `${tick.offsetDays * ganttDayWidth}px`,
                                    width: `${Math.max(tick.spanDays * ganttDayWidth, ganttDayWidth)}px`,
                                  }}
                                >
                                  <strong>{ganttDayWidth >= 18 ? tick.rangeLabel : tick.label}</strong>
                                  <span>
                                    {formatGanttModeValue(
                                      ganttTimeMode,
                                      ganttTimeMode === 'planned'
                                        ? tick.plannedSeconds
                                        : ganttTimeMode === 'actual'
                                        ? tick.actualSeconds
                                        : tick.deltaSeconds,
                                      language,
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {gantt.projects.map((project) => (
                            <div key={project.id} className="gantt-timeline-row">
                              <div className="gantt-timeline">
                                <div
                                  className="gantt-project-bar"
                                  style={{
                                    left: `${project.offsetDays * ganttDayWidth}px`,
                                    width: `${Math.max(project.totalDays * ganttDayWidth, ganttDayWidth)}px`,
                                  }}
                                >
                                  {project.segments.map((segment) => (
                                    <div
                                      key={segment.id}
                                      className={`gantt-segment ${
                                        segment.mode === 'schedule-only'
                                          ? 'gantt-segment--schedule'
                                          : 'gantt-segment--writing'
                                      }`.trim()}
                                      data-tooltip={`${segment.weekLabel} · ${segment.stageLabel} · ${segment.timeTooltipLabel} · ${segment.rangeLabel}`}
                                      style={{
                                        ...segment.appearance,
                                        left: `${segment.offsetDays * ganttDayWidth}px`,
                                        width: `${Math.max(segment.spanDays * ganttDayWidth, 18)}px`,
                                      }}
                                    >
                                      <span className="gantt-segment-week">{segment.weekLabel}</span>
                                      {segment.showTime ? (
                                        <span className="gantt-segment-time">
                                          {ganttTimeMode === 'planned'
                                            ? segment.plannedTimeLabel
                                            : ganttTimeMode === 'actual'
                                            ? segment.actualTimeLabel
                                            : segment.deltaTimeLabel}
                                        </span>
                                      ) : null}
                                      {segment.showStage ? (
                                        <span className="gantt-segment-stage">{segment.stageLabel}</span>
                                      ) : null}
                                      {segment.showRange ? (
                                        <span className="gantt-segment-range">{segment.rangeLabel}</span>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="summary-warning summary-warning--inline">{text.ganttNoProjects}</div>
                  )}

                  {gantt.unscheduledProjects.length > 0 ? (
                    <div className="gantt-unscheduled">
                      {gantt.unscheduledProjects.map((project, index) => (
                        <div key={project.id} className="gantt-unscheduled-row">
                          <strong>{getProjectLabel(project, text, index)}</strong>
                          <span>{text.ganttUnscheduled}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </article>
          </section>
        </div>

        <aside className={`panel summary-strip ${isSummaryCollapsed ? 'summary-strip--collapsed' : ''}`.trim()}>
          <button
            type="button"
            className="summary-edge-toggle"
            onClick={() => setIsSummaryCollapsed((current) => !current)}
            aria-expanded={!isSummaryCollapsed}
            aria-label={isSummaryCollapsed ? text.summaryShow : text.summaryHide}
            title={isSummaryCollapsed ? text.summaryShow : text.summaryHide}
          >
            {isSummaryCollapsed ? '‹' : '›'}
          </button>

          {!isSummaryCollapsed ? (
            <>
              <div className="sidebar-section">
                <div className="summary-controls">
                  <div className="field schedule-mode-field">
                    <span>{text.scheduleModeLabel}</span>
                    <div
                      className="language-toggle schedule-toggle"
                      aria-label={text.scheduleModeLabel}
                      title={text.scheduleModeHelp}
                    >
                      <button
                        type="button"
                        className={
                          activeProject.scheduleMode === 'week-driven'
                            ? 'language-button language-button--active'
                            : 'language-button'
                        }
                        onClick={() => updateProject({ scheduleMode: 'week-driven' })}
                      >
                        {text.scheduleModeWeek}
                      </button>
                      <button
                        type="button"
                        className={
                          activeProject.scheduleMode === 'date-driven'
                            ? 'language-button language-button--active'
                            : 'language-button'
                        }
                        onClick={() => updateProject({ scheduleMode: 'date-driven' })}
                      >
                        {text.scheduleModeDate}
                      </button>
                    </div>
                  </div>
                  <div className="date-grid">
                    <label className="field">
                      <span>{text.startDate}</span>
                      <input
                        type="date"
                        value={activeProject.startDate}
                        onChange={(event) => updateProject({ startDate: event.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>{text.endDate}</span>
                      <input
                        type="date"
                        value={activeProject.endDate}
                        onChange={(event) => updateProject({ endDate: event.target.value })}
                        disabled={activeProject.scheduleMode === 'week-driven'}
                        title={activeProject.scheduleMode === 'week-driven' ? text.scheduleModeHelp : undefined}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="summary-dashboard">
            <section className="summary-panel summary-panel--hero">
              <div className="summary-panel-header">
                <p className="summary-subtitle">{text.coreStatusTitle}</p>
              </div>
              <div className="summary-week-card">
                <span className="summary-hero-label editable-label">
                  <span>{text.scoreDuration}</span>
                  <span className="edit-indicator" aria-hidden="true">✎</span>
                </span>
                <input
                  className={`summary-week-card-input mono ${isScoreDurationInvalid ? 'time-input--invalid' : ''}`.trim()}
                  value={activeProject.scoreDuration}
                  onChange={(event) =>
                    handleTimeDraftChange(event, (value) => updateProject({ scoreDuration: value }))
                  }
                  onBlur={(event) => handleTimeCommit(event, (value) => updateProject({ scoreDuration: value }))}
                  onKeyDown={(event) =>
                    handleTimeKeyDown(event, (value) => updateProject({ scoreDuration: value }))
                  }
                  onFocus={(event) => event.currentTarget.select()}
                  placeholder="00:00"
                  inputMode="numeric"
                  aria-label={text.scoreDuration}
                  aria-invalid={isScoreDurationInvalid}
                  title={isScoreDurationInvalid ? text.timeFormatInvalid : text.editable}
                />
              </div>
              <div className="summary-hero">
                <div className="summary-week-card">
                  <span className="summary-hero-label">{text.weekShort}</span>
                  <strong className="summary-week-card-value">
                    {writingTimeline.currentWeek === '-' || summary.writingWeeks === 0
                      ? '-'
                      : `${writingTimeline.currentWeek}/${summary.writingWeeks}`}
                  </strong>
                </div>
                <div className="summary-hero-head">
                  <div className={`summary-hero-stat ${summary.isWeeksMismatch || summary.isDaysMismatch ? 'summary-hero-stat--warning' : ''}`}>
                    <span className="summary-hero-label">{text.daysLeftCompact}</span>
                    <strong className="summary-hero-main">
                      {timeline.daysLeft}
                    </strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="summary-panel">
              <div className="summary-panel-header">
                <p className="summary-subtitle">{text.progressTitle}</p>
              </div>
              <div className="summary-metric-list">
                <div className="summary-metric-row">
                  <span className="summary-metric-label">{text.actual}</span>
                  <strong className="summary-metric-value">{formatMinuteSecond(summary.totalActualSeconds)}</strong>
                </div>
                <div className="summary-metric-row">
                  <span className="summary-metric-label">{text.writingTimeLeft}</span>
                  <strong className="summary-metric-value">{formatMinuteSecond(summary.totalMinsLeftSeconds)}</strong>
                </div>
                <div className="summary-metric-row">
                  <span className="summary-metric-label">{text.delta}</span>
                  <strong className="summary-metric-value variance">
                    {summary.varianceSeconds > 0 ? '+' : summary.varianceSeconds < 0 ? '-' : ''}
                    {formatMinuteSecond(Math.abs(summary.varianceSeconds))}
                  </strong>
                </div>
              </div>
            </section>

          </div>
            </>
          ) : null}

        </aside>
      </section>
      )}

      {stageEditor ? (
        <div className="modal-backdrop" onClick={() => setStageEditor(null)}>
          <div
            className="modal-card modal-card--stage-editor"
            style={getColorAppearanceStyle(stageEditor.colorKey)}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-header panel-header--compact">
              <div>
                <h2>{stageEditor.mode === 'create' ? text.addStage : text.editStage}</h2>
              </div>
              <button
                type="button"
                className="popup-close-button"
                onClick={() => setStageEditor(null)}
                aria-label={text.closeStageEditor}
              >
                ×
              </button>
            </div>

            <div className="sidebar-section sidebar-section--stacked">
              <label className="field">
                <span>{text.stageName}</span>
                <input
                  className="stage-editor-preview-field"
                  ref={stageEditorNameInputRef}
                  value={stageEditor.name}
                  onChange={(event) =>
                    setStageEditor((current) =>
                      current ? { ...current, name: event.target.value } : current,
                    )
                  }
                  onKeyDown={handleStageEditorKeyDown}
                />
              </label>

              <label className="field">
                <span>{text.efficiency}</span>
                <input
                  className="stage-editor-border-field"
                  type="number"
                  step="0.1"
                  min="0"
                  value={stageEditor.efficiency}
                  disabled={stageEditor.planningMode === 'schedule-only'}
                  onChange={(event) =>
                    setStageEditor((current) =>
                      current ? { ...current, efficiency: event.target.value } : current,
                    )
                  }
                  onKeyDown={handleStageEditorKeyDown}
                />
              </label>

              <div className="field">
                <span>{text.stageColor}</span>
                <div className="stage-color-grid" role="radiogroup" aria-label={text.stageColor}>
                  {stageColorOrder.map((colorKey) => {
                    const isActive = stageEditor.colorKey === colorKey
                    return (
                      <button
                        key={colorKey}
                        type="button"
                        className={`stage-color-button ${isActive ? 'stage-color-button--active' : ''}`.trim()}
                        style={getColorAppearanceStyle(colorKey)}
                        onClick={() =>
                          setStageEditor((current) =>
                            current ? { ...current, colorKey } : current,
                          )
                        }
                        aria-label={getStageColorLabel(colorKey, language)}
                        aria-pressed={isActive}
                        title={getStageColorLabel(colorKey, language)}
                      >
                        <span className="stage-color-button-swatch" />
                      </button>
                    )
                  })}
                </div>
              </div>

              <label className="field">
                <span>{text.stageType}</span>
                <select
                  className="stage-editor-border-field"
                  value={stageEditor.planningMode}
                  onChange={(event) =>
                    setStageEditor((current) => {
                      if (!current) {
                        return current
                      }

                      const nextPlanningMode =
                        event.target.value === 'schedule-only' ? 'schedule-only' : 'timed'

                      return {
                        ...current,
                        planningMode: nextPlanningMode,
                        colorKey:
                          nextPlanningMode === 'schedule-only'
                            ? 'gold'
                            : current.colorKey === 'gold'
                            ? inferStageColorKey({
                                id: current.stageId || '',
                                name: current.name,
                                efficiency:
                                  current.efficiency === '0.0' ? 1 : Math.max(0, Number(current.efficiency) || 1),
                                planningMode: nextPlanningMode,
                              })
                            : current.colorKey,
                        efficiency:
                          nextPlanningMode === 'schedule-only'
                            ? '0.0'
                            : current.efficiency === '0.0'
                            ? '1.0'
                            : current.efficiency,
                      }
                    })
                  }
                >
                  <option value="timed">{text.stageTypeTimed}</option>
                  <option value="schedule-only">{text.stageTypeScheduleOnly}</option>
                </select>
                <small className="field-help">
                  {stageEditor.planningMode === 'schedule-only'
                    ? text.stageTypeScheduleOnlyHelp
                    : text.stageTypeTimedHelp}
                </small>
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setStageEditor(null)}>
                {text.cancel}
              </button>
              <button type="button" className="primary-button" onClick={saveStageEditor}>
                {text.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isTeamManagerOpen ? (
        <div className="modal-backdrop" onClick={() => setIsTeamManagerOpen(false)}>
          <div
            className="modal-card modal-card--team-manager"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-header panel-header--compact">
              <div>
                <h2>{text.workspaceManageTitle}</h2>
                <p className="hero-copy">{text.workspaceManageCopy}</p>
              </div>
              <button
                type="button"
                className="popup-close-button"
                onClick={() => setIsTeamManagerOpen(false)}
                aria-label={text.closeMenu}
              >
                ×
              </button>
            </div>

            <div className="team-manager-grid">
              <section className="team-manager-panel">
                <span className="action-menu-section-label">{text.menuTeam}</span>
                {cloudWorkspaceRole === 'owner' ? (
                  <>
                    <label className="field action-menu-field">
                      <span>{text.workspaceInvite}</span>
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        placeholder={text.workspaceInvitePlaceholder}
                      />
                    </label>
                    <p className="action-menu-help">{text.workspaceInviteHelp}</p>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void handleInviteMember()}
                      disabled={isInviteSubmitting}
                    >
                      {text.workspaceInviteButton}
                    </button>
                  </>
                ) : (
                  <p className="action-menu-help">{text.workspaceOwnerOnly}</p>
                )}
                {inviteMessage ? <div className="summary-warning summary-warning--inline">{inviteMessage}</div> : null}
                {memberActionMessage ? <div className="summary-warning summary-warning--inline">{memberActionMessage}</div> : null}
              </section>

              <section className="team-manager-panel">
                <div className="team-manager-header">
                  <span className="action-menu-section-label">{text.workspaceMembersTitle}</span>
                  <button
                    type="button"
                    className="action-menu-inline-button"
                    onClick={() => void refreshWorkspaceMembers()}
                  >
                    {text.workspaceRefreshMembers}
                  </button>
                </div>

                {isWorkspaceMembersLoading ? (
                  <p className="action-menu-help">{text.authSyncing}</p>
                ) : workspaceMembers.length > 0 ? (
                  <div className="team-manager-list">
                    {workspaceMembers.map((member) => (
                      <div key={member.id} className="team-manager-row">
                        <div className="team-manager-meta">
                          <strong>{member.email}</strong>
                          <span>
                            {member.userId ? text.workspaceMemberActive : text.workspaceMemberPending}
                          </span>
                        </div>
                        <div className="team-manager-actions">
                          {member.role === 'owner' ? (
                            <span className="team-manager-badge">{text.workspaceRoleOwner}</span>
                          ) : (
                            <label className="team-manager-select">
                              <span>{text.workspaceRoleChange}</span>
                              <select
                                value={member.role}
                                onChange={(event) =>
                                  void handleMemberRoleChange(member.id, event.target.value as 'editor' | 'viewer')
                                }
                                disabled={updatingMemberId === member.id}
                              >
                                <option value="editor">{text.workspaceRoleEditor}</option>
                                <option value="viewer">{text.workspaceRoleViewer}</option>
                              </select>
                            </label>
                          )}
                          {cloudWorkspaceRole === 'owner' && member.role !== 'owner' ? (
                            <button
                              type="button"
                              className="action-menu-inline-button action-menu-inline-button--danger"
                              onClick={() => void handleRemoveMember(member.id)}
                              disabled={removingMemberId === member.id}
                            >
                              {text.workspaceRemoveMember}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="action-menu-help">{text.workspaceNoMembers}</p>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {projectEditor ? (
        <div className="modal-backdrop" onClick={() => setProjectEditor(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header panel-header--compact">
              <div>
                <h2>{projectEditor.mode === 'create' ? text.newProject : text.editProject}</h2>
              </div>
              <button
                type="button"
                className="popup-close-button"
                onClick={() => setProjectEditor(null)}
                aria-label={text.closeProjectEditor}
              >
                ×
              </button>
            </div>

            <div className="sidebar-section sidebar-section--stacked">
              <label className="field">
                <span>{text.projectName}</span>
                <input
                  ref={projectEditorNameInputRef}
                  value={projectEditor.name}
                  onChange={(event) =>
                    setProjectEditor((current) =>
                      current ? { ...current, name: event.target.value } : current,
                    )
                  }
                  onKeyDown={handleProjectEditorKeyDown}
                />
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setProjectEditor(null)}>
                {text.cancel}
              </button>
              <button type="button" className="primary-button" onClick={saveProjectEditor}>
                {text.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importConflict ? (
        <div className="modal-backdrop" onClick={() => setImportConflict(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header panel-header--compact">
              <div>
                <h2>{text.importConflictTitle}</h2>
              </div>
              <button
                type="button"
                className="popup-close-button"
                onClick={() => setImportConflict(null)}
                aria-label={text.closeImportConflict}
              >
                ×
              </button>
            </div>

            <div className="sidebar-section sidebar-section--stacked">
              <p>{text.importConflictBody}</p>
            </div>

            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setImportConflict(null)}>
                {text.cancel}
              </button>
              <button type="button" className="ghost-button" onClick={keepBothImportedProject}>
                {text.keepBothProjects}
              </button>
              <button type="button" className="primary-button" onClick={overwriteImportedProject}>
                {text.overwriteProject}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default App
