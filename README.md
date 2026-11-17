# 悄悄话

一个纯前端的多页悄悄话网站。访客输入姓名后，只会看到对应的一张纸条；纸条可以前后翻页。未匹配的姓名会进入一组普通祝福，不显示“查无此人”之类的结果页。

源码以 MIT License 开源。

## 文件结构

```text
whispers/
├─ index.html          # 访客页面
├─ styles.css          # 访客页面样式
├─ app.js              # 姓名匹配、纸条展示与翻页
├─ data-utils.js       # 数据与时间格式工具
├─ notes.json          # 正式内容
├─ demo-notes.json     # 仅供预览的演示内容
├─ publisher.html      # 手机可用的发布端
├─ publisher.css
├─ publisher.js
├─ notes.schema.json   # 数据结构说明
├─ robots.txt
└─ assets/
   └─ favicon.svg
```

## 本地预览

不要在浏览器中直接双击 `index.html`，因为 `fetch` 读取 JSON 需要本地 HTTP 服务。

- 使用 VS Code 的 Live Server，打开项目根目录。
- 或在项目目录运行 `python -m http.server 8000`，访问 `http://localhost:8000/`。

演示模式：

```text
http://localhost:8000/?demo=1
```

在演示模式中输入 `小禾`，可以查看三张示例纸条。正式模式读取 `notes.json`，正式数据默认不包含虚构姓名。

## Git 与 VS Code

仓库已经初始化为 `main` 分支并完成首次提交。后续可以在 VS Code 左侧的“源代码管理”中修改、暂存和提交。

如需连接新的 GitHub 仓库，在 VS Code 的源代码管理菜单中选择发布仓库，或执行：

```text
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

## 数据结构

每个名字对应一个 `person`，名字下可以有多张纸条。每张纸条拥有独立正文和提交时间：

```json
{
  "version": 1,
  "people": [
    {
      "id": "person-example",
      "name": "名字",
      "aliases": ["别名"],
      "notes": [
        {
          "id": "note-example",
          "message": "纸条正文",
          "createdAt": "2026-12-31T23:47:00+08:00"
        }
      ]
    }
  ],
  "others": {
    "notes": [
      {
        "id": "fallback-example",
        "message": "普通祝福",
        "createdAt": "2026-12-31T23:47:00+08:00"
      }
    ]
  }
}
```

姓名和别名会去除首尾空格、合并连续空格，并统一全角与半角；不会进行简繁转换或模糊匹配。

## 发布端

访问部署地址下的 `publisher.html`。发布端不会从首页链接出去，但它的页面本身仍然是公开静态文件；真正的写入权限由 GitHub 令牌控制。

发布端支持：

- 按名字查看和编辑多张纸条
- 添加别名、调整纸条顺序、修改提交时间
- 编辑未匹配时展示的普通祝福
- 自动保存本机草稿
- 下载或复制完整的 `notes.json`
- 配置 GitHub 仓库后直接提交更新

### GitHub 直接发布

1. 在 GitHub 创建仅限该仓库的 Fine-grained personal access token。
2. 给令牌授予 **Repository permissions → Contents: Read and write**。
3. 尽量缩短令牌有效期。
4. 在发布端填写 `owner/repository`、分支和文件路径，再粘贴令牌。

令牌只保存在当前标签页的会话存储中，不会写进 `notes.json`，也不会发送到 GitHub 以外的地址。关闭标签页后需要重新填写。

### 不上传令牌的方式

在发布端编辑完成后，点击“下载 JSON”，将文件覆盖到仓库根目录的 `notes.json`，随后提交并推送。

## 部署

### GitHub Pages

1. 将整个 `whispers` 目录内容推送到 GitHub 仓库。
2. 打开仓库的 **Settings → Pages**。
3. 选择要发布的分支，目录选择仓库根目录。
4. 等待部署完成并访问生成的网址。

### Vercel 或 Netlify

新建静态站点项目，构建命令留空，发布目录设为项目根目录即可。

## 隐私边界

部署后的 `notes.json` 是公开静态资源。知道网站地址的人可以通过开发者工具或直接访问该文件读取全部姓名与纸条。页面设计、`robots.txt` 和发布端都不会改变这一点。

这个项目适合家人朋友之间的低敏感内容，不应存放密码、住址、健康状况等真正需要保密的资料。

## 更新后的生效方式

Git 提交并触发部署后，访客重新打开或刷新网站即可读取新内容。项目不包含更新通知、已读状态或服务端数据库。
