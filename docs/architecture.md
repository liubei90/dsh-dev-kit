# 架构(Architecture)

本文件是模块地图:应用如何组成、模块如何关联、扩展点在哪。**改架构前先读本页**,重大结构决策要写 Agent Note。

## 组成(当前占位,随实现填充)

```
apps/web  → 页面/组件/客户端状态 → 经 HTTP 调用 apps/api
apps/api  → HTTP 路由 → 服务层 → 数据访问(DB/外部服务)
packages/shared → 前后端共享的类型、DTO、校验、常量(契约单一来源)
```

## 分层规则

- 控制器薄、服务层承载业务、数据访问隔离在仓储/DAO。
- `apps/*` 之间的直接依赖禁止;共享经 `packages/shared`。
- 新能力先写 [proposed Agent Note](../.agents/notes/proposed/),评审后再实现。

## 扩展点

(随项目演进填充:认证中间件、插件式 provider、事件总线等。)

## 决策记录

架构决策与理由在 [Agent Notes](../.agents/notes/README.md);本页只放当前事实的地图。
