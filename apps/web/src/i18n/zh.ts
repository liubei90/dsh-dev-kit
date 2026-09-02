// Typed dictionary for all visible UI copy (Chinese default). Components
// reference copy.* and never hardcode strings, per the root AGENTS.md i18n
// rule. Server errors map by stable code; unknown codes fall back to the
// code itself so new server codes never render an empty message.

export const copy = {
  appTitle: 'dsh-dev-kit',
  tabLogin: '登录',
  tabRegister: '注册',
  emailLabel: '邮箱',
  emailPlaceholder: 'you@example.com',
  passwordLabel: '密码',
  passwordPlaceholder: '至少 8 个字符',
  submitLogin: '登录',
  submitRegister: '注册',
  submitting: '处理中…',
  logout: '退出登录',
  signedInAs: (email: string): string => `已登录:${email}`,
  registerSucceeded: '注册成功,请登录',
  alreadyHaveAccount: '已有账号?去登录',
  noAccountYet: '还没有账号?去注册',
  errors: {
    EMAIL_INVALID: '邮箱格式不正确',
    PASSWORD_TOO_SHORT: '密码至少需要 8 个字符',
    EMAIL_TAKEN: '该邮箱已被注册',
    INVALID_CREDENTIALS: '邮箱或密码错误',
    UNAUTHORIZED: '登录已过期,请重新登录',
    INTERNAL: '服务器开小差了,请稍后再试',
    NOT_FOUND: '请求的接口不存在',
    NETWORK: '网络错误,请检查网络后重试',
  },
} as const

export function errorMessage(code: string): string {
  return copy.errors[code as keyof typeof copy.errors] ?? code
}
