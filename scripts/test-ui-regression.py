from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path

from playwright.sync_api import Route, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = ROOT / "artifacts" / "ui-regression-mobile.png"
CHAT_SCREENSHOT = ROOT / "artifacts" / "ui-chat-memory.png"
BILINGUAL_SCREENSHOT = ROOT / "artifacts" / "ui-bilingual-exercises.png"
CHAT_REQUESTS: list[dict] = []
SUMMARY_REQUESTS: list[dict] = []
TODAY = date.today().isoformat()
YESTERDAY = (date.today() - timedelta(days=1)).isoformat()


def fulfill_model_request(route: Route) -> None:
    request = route.request
    try:
        payload = request.post_data_json if request.post_data else {}
    except (json.JSONDecodeError, TypeError):
        payload = {}
    action = payload.get("action", "")
    if action == "chatSummary":
        SUMMARY_REQUESTS.append(payload)
        route.fulfill(
            status=200,
            content_type="application/json; charset=utf-8",
            body=json.dumps(
                {"content": "用户近期关注睡眠、饮食和卧推训练；所有记录需确认。"},
                ensure_ascii=False,
            ),
        )
        return
    if action == "chat":
        CHAT_REQUESTS.append(payload)
        last_message = " ".join(item.get("text", "") for item in payload.get("messages", [])[-2:])
        if "修改" in last_message and payload.get("requestedDateHint"):
            content = {
                "reply": "已读取该日期原记录，并整理为替换后的完整训练清单。",
                "action": {"type": "workout", "date": payload["requestedDateHint"], "title": "AI修改后的卧推训练", "durationMinutes": 50, "averageRpe": 8, "exercises": [
                    {"exerciseId": "bench", "name": "杠铃卧推", "sets": 5, "reps": "6 次", "weightKg": 82.5, "rpe": 8},
                    {"name": "坐姿推胸", "sets": 3, "reps": "10 次", "weightKg": 55, "rpe": 8},
                ], "note": "替换指定日期训练记录"},
            }
        elif "鸡胸饭" in last_message:
            content = {
                "reply": "已整理为一条待确认饮食记录。",
                "action": {"type": "nutrition", "mealName": "AI鸡胸饭", "grams": 420, "calories": 620, "protein": 45, "carbs": 72, "fat": 16},
            }
        elif "卧推" in last_message and "做了" in last_message:
            workout_date = YESTERDAY if "昨天" in last_message else TODAY
            content = {
                "reply": "已整理为一条待确认的指定日期训练记录。",
                "action": {"type": "workout", "date": workout_date, "title": "AI补录卧推训练", "durationMinutes": 45, "averageRpe": 8, "exercises": [{"exerciseId": "bench", "name": "杠铃卧推", "sets": 4, "reps": "8 次", "weightKg": 80, "rpe": 8}], "note": "自由对话补录"},
            }
        else:
            content = {"reply": "根据当前记录，今天保持训练量并关注睡眠。", "action": None}
        route.fulfill(status=200, content_type="application/json; charset=utf-8", body=json.dumps({"content": json.dumps(content, ensure_ascii=False)}, ensure_ascii=False))
        return
    responses = {
        "models": {"models": ["mock-model", "mock-vision"]},
        "textProbe": {"content": "练途连接成功"},
        "probe": {"content": "视觉测试成功：红色圆形与蓝色方形"},
        "coach": {"content": "建议保持原计划；若确认调整，从下一次未完成训练开始。"},
        "plan": {"content": "建议保持原计划；若确认调整，从下一次未完成训练开始。"},
    }
    route.fulfill(
        status=200,
        content_type="application/json; charset=utf-8",
        body=json.dumps(responses.get(action, {"content": "练途测试回复"}), ensure_ascii=False),
    )


def main() -> None:
    SCREENSHOT.parent.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        page.on("pageerror", lambda error: errors.append(f"pageerror: {error}"))
        page.on(
            "console",
            lambda message: errors.append(f"console: {message.text}") if message.type == "error" else None,
        )
        page.route("**/api/bigmodel", fulfill_model_request)
        page.goto("http://127.0.0.1:4173", wait_until="networkidle")

        if page.get_by_role("button", name="跳过", exact=True).count():
            page.get_by_role("button", name="跳过", exact=True).click()

        page.get_by_role("navigation", name="主导航").get_by_role("button", name="计划").click()
        page.get_by_role("button", name="力量", exact=True).click()
        page.get_by_role("button", name="4 天", exact=True).click()
        page.get_by_text("上下肢二分化 × 2").first.wait_for()
        assert page.locator(".calendar-grid button em").count() >= 28
        assert page.locator(".calendar-grid button em").filter(has_not_text="").count() >= 28

        editor_button = page.get_by_role("button", name="修改或添加当天动作")
        if editor_button.count() == 0:
            page.locator(".calendar-grid button.train:not(.completed)").first.click()
            editor_button = page.get_by_role("button", name="修改或添加当天动作")
        editor_button.click()
        search = page.get_by_placeholder("搜索动作中文名、英文名、肌群或器械")
        search.fill("barbell bench press")
        page.locator(".library-results article").first.wait_for()
        first_result_text = page.locator(".library-results article").first.inner_text()
        assert "杠铃卧推" in first_result_text
        assert "bench press" in first_result_text.lower()
        page.screenshot(path=str(BILINGUAL_SCREENSHOT), full_page=True)
        page.locator(".library-results .library-exercise-info").first.click()
        page.locator('img[src*="/exercises-dataset/videos/"]').wait_for()
        page.get_by_role("button", name="返回训练").click()
        result = page.locator(".library-results article").first
        add = result.get_by_role("button", name="添加")
        if add.count():
            add.click()
        page.get_by_role("button", name="保存当天安排").click()
        page.get_by_text("只修改这一天", exact=False).wait_for()

        page.get_by_role("navigation", name="主导航").get_by_role("button", name="热量镜").click()
        before_energy_target = int(page.locator(".target-breakdown b").inner_text().split()[0])
        page.get_by_label("增减 kcal").fill("120")
        page.get_by_label("说明").fill("手环修正")
        page.get_by_role("button", name="记入今天消耗").click()
        after_energy_target = int(page.locator(".target-breakdown b").inner_text().split()[0])
        assert after_energy_target - before_energy_target == 120
        page.get_by_label("食物或餐次名称").fill("手动午餐")
        page.get_by_label("总重量（g，可选）").fill("420")
        page.get_by_label("热量（kcal）").fill("650")
        page.get_by_label("蛋白质（g）").fill("42")
        page.get_by_label("碳水（g）").fill("76")
        page.get_by_label("脂肪（g）").fill("18")
        page.get_by_role("button", name="手动记入今天").click()
        page.get_by_text("手动午餐", exact=True).wait_for()

        page.get_by_role("navigation", name="主导航").get_by_role("button", name="我的").click()
        assert page.get_by_label("允许 AI 记录饮食").is_checked()
        assert page.get_by_label("允许 AI 记录训练").is_checked()
        initial_target = page.locator(".calorie-target-card h2").inner_text()
        assert "2000 kcal" not in initial_target
        page.get_by_label("体重（kg）").fill("80")
        page.get_by_label("身高（cm）").fill("180")
        page.get_by_label("年龄").fill("30")
        page.get_by_label("性别").select_option("male")
        page.get_by_label("日常非训练活动").select_option("active")
        assert page.locator(".calorie-target-card h2").inner_text() != initial_target
        assert "active" in (page.get_by_role("button", name="中英双语", exact=True).get_attribute("class") or "")
        page.get_by_role("button", name="English", exact=True).click()
        page.get_by_role("navigation", name="主导航").get_by_role("button", name="计划").click()
        page.get_by_role("button", name="修改或添加当天动作").click()
        english_search = page.get_by_placeholder("搜索动作中文名、英文名、肌群或器械")
        english_search.fill("杠铃卧推")
        page.locator(".library-results article").first.wait_for()
        english_result_text = page.locator(".library-results article").first.inner_text()
        assert "bench press" in english_result_text.lower()
        assert "杠铃卧推" not in english_result_text
        page.get_by_role("button", name="取消", exact=True).click()
        page.get_by_role("navigation", name="主导航").get_by_role("button", name="我的").click()
        page.get_by_role("button", name="中英双语", exact=True).click()
        page.locator(".provider-grid button", has_text="ChatGPT 账号").click()
        chatgpt_login = page.get_by_role("button", name="使用 ChatGPT 账号登录")
        assert chatgpt_login.is_disabled()
        page.get_by_text("ChatGPT 账号登录仅支持练途 APK", exact=True).first.wait_for()
        page.locator(".provider-grid button", has_text="智谱").click()
        page.get_by_label("API 密钥（本地模型可留空）").fill("test-key")
        page.get_by_role("button", name="重新读取").click()
        page.get_by_text("已自动读取 2 个模型").wait_for()
        page.get_by_label("自动获取的模型").select_option("mock-model")
        page.get_by_role("button", name="普通测试").click()
        page.locator(".connection-result.success").get_by_text("连接成功", exact=True).wait_for()
        assert "练途连接成功" in page.locator(".connection-result.success").inner_text()
        page.get_by_role("button", name="视觉测试").click()
        page.locator(".connection-result.success").get_by_text("连接成功", exact=True).wait_for()
        assert "视觉测试成功" in page.locator(".connection-result.success").inner_text()
        page.reload(wait_until="networkidle")
        page.get_by_role("navigation", name="主导航").get_by_role("button", name="我的").click()
        assert page.get_by_label("API 密钥（本地模型可留空）").input_value() == "test-key"
        assert page.get_by_label("模型 ID 手动输入").input_value() == "mock-model"

        page.get_by_role("navigation", name="主导航").get_by_role("button", name="教练").click()
        page.get_by_placeholder("输入训练感受、饮食、睡眠、体重、日期或时间安排…").fill("我昨晚睡了 6.5 小时，今天训练怎么调整？")
        page.get_by_role("button", name="发送").click()
        page.get_by_text("根据当前记录，今天保持训练量并关注睡眠。").wait_for()

        composer = page.get_by_placeholder("输入训练感受、饮食、睡眠、体重、日期或时间安排…")
        composer.fill("午餐吃了鸡胸饭，帮我记入饮食")
        page.get_by_role("button", name="发送").click()
        page.get_by_text("待确认饮食记录", exact=True).wait_for()
        page.locator(".chat-action").last.get_by_role("button", name="确认记录").click()
        page.get_by_role("navigation", name="主导航").get_by_role("button", name="热量镜").click()
        page.get_by_text("AI鸡胸饭", exact=True).wait_for()

        page.get_by_role("navigation", name="主导航").get_by_role("button", name="我的").click()
        page.get_by_label("允许 AI 记录饮食").uncheck()
        page.get_by_role("navigation", name="主导航").get_by_role("button", name="教练").click()
        assistants = page.locator(".chat-thread article.assistant")
        assistant_count = assistants.count()
        composer.fill("午餐又吃了鸡胸饭，帮我记入饮食")
        page.get_by_role("button", name="发送").click()
        assistants.nth(assistant_count).wait_for()
        assert assistants.nth(assistant_count).locator(".chat-action").count() == 0
        page.get_by_role("navigation", name="主导航").get_by_role("button", name="我的").click()
        page.get_by_label("允许 AI 记录饮食").check()

        page.get_by_role("navigation", name="主导航").get_by_role("button", name="教练").click()
        composer.fill("昨天卧推80kg做了4组每组8次，RPE 8，帮我补录")
        page.get_by_role("button", name="发送").click()
        page.get_by_text("待确认训练记录", exact=True).wait_for()
        page.locator(".chat-action").last.get_by_role("button", name="确认记录").click()
        completed_yesterday = page.locator(f'.calendar-grid button.completed[aria-label^="{YESTERDAY}"]')
        completed_yesterday.wait_for()
        assert "已完成" in completed_yesterday.get_attribute("aria-label")
        page.get_by_role("navigation", name="主导航").get_by_role("button", name="教练").click()
        yesterday_label = f"{date.fromisoformat(YESTERDAY).month}.{date.fromisoformat(YESTERDAY).day}"
        composer = page.get_by_placeholder("输入训练感受、饮食、睡眠、体重、日期或时间安排…")
        composer.fill(f"把{yesterday_label}的训练记录修改为卧推5组6次，再加坐姿推胸3组10次")
        page.get_by_role("button", name="发送").click()
        page.get_by_text("替换后的完整训练清单", exact=False).wait_for()
        page.locator(".chat-action").last.get_by_role("button", name="确认记录").click()
        page.get_by_text("坐姿推胸", exact=False).first.wait_for()
        completed_yesterday = page.locator(f'.calendar-grid button.completed[aria-label^="{YESTERDAY}"]')
        completed_yesterday.wait_for()
        page.get_by_role("navigation", name="主导航").get_by_role("button", name="教练").click()
        composer = page.get_by_placeholder("输入训练感受、饮食、睡眠、体重、日期或时间安排…")
        assistants = page.locator(".chat-thread article.assistant")

        for index in range(3):
            assistant_count = assistants.count()
            composer.fill(f"继续记住我的目标 {index + 1}")
            page.get_by_role("button", name="发送").click()
            assistants.nth(assistant_count).wait_for()
        page.get_by_text("已压缩 7 条旧消息", exact=True).wait_for()
        page.get_by_role("button", name="长期摘要", exact=False).click()
        page.get_by_role("dialog", name="AI 教练长期摘要").get_by_text("用户近期关注睡眠、饮食和卧推训练；所有记录需确认。", exact=True).wait_for()
        page.get_by_role("button", name="关闭", exact=True).click()
        page.get_by_role("button", name="回到最新", exact=True).click()
        page.screenshot(path=str(CHAT_SCREENSHOT), full_page=True)

        page.get_by_role("navigation", name="主导航").get_by_role("button", name="计划").click()
        page.get_by_role("button", name="生成综合计划").click()
        page.get_by_text("建议保持原计划；若确认调整，从下一次未完成训练开始。").wait_for()
        assert page.get_by_text("undefined", exact=False).count() == 0
        page.get_by_role("button", name="保持原计划").click()

        page.get_by_role("navigation", name="主导航").get_by_role("button", name="计划").click()
        completed_day = page.locator(".calendar-grid button.completed")
        completed_day.first.wait_for()
        assert "已完成" in completed_day.first.get_attribute("aria-label")

        page.get_by_role("navigation", name="主导航").get_by_role("button", name="今日").click()
        page.locator(".training-start").click()
        first_exercise = page.locator(".workout-exercises article").first
        first_exercise.locator(".set-log-row").nth(0).locator('input[type="number"]').nth(0).fill("80")
        first_exercise.locator(".set-log-row").nth(0).locator('input:not([type="number"])').fill("8")
        first_exercise.locator(".set-log-row").nth(0).locator('input[type="number"]').nth(1).fill("7.5")
        first_exercise.locator(".set-log-row").nth(0).get_by_role("button").click()
        first_exercise.locator(".set-log-row").nth(1).locator('input[type="number"]').nth(0).fill("82.5")
        first_exercise.locator(".set-log-row").nth(1).locator('input:not([type="number"])').fill("6")
        first_exercise.locator(".set-log-row").nth(1).locator('input[type="number"]').nth(1).fill("9")
        first_exercise.locator(".set-log-row").nth(1).get_by_role("button").click()
        page.get_by_placeholder("例如：睡眠不足、右膝感觉良好…").fill("测试自动保存")
        page.get_by_role("button", name="暂存退出", exact=True).click()
        page.get_by_text("未完成训练 · 已自动保存", exact=True).wait_for()
        assert "已完成 2 /" in page.locator(".workout-resume-card").inner_text()
        page.reload(wait_until="networkidle")
        page.get_by_text("未完成训练 · 已自动保存", exact=True).wait_for()
        page.get_by_role("button", name="继续训练", exact=True).click()
        first_exercise = page.locator(".workout-exercises article").first
        assert first_exercise.locator(".set-log-row").nth(0).locator('input[type="number"]').nth(0).input_value() == "80"
        assert first_exercise.locator(".set-log-row").nth(0).locator('input:not([type="number"])').input_value() == "8"
        assert first_exercise.locator(".set-log-row").nth(0).locator('input[type="number"]').nth(1).input_value() == "7.5"
        assert first_exercise.locator(".set-log-row").nth(1).locator('input[type="number"]').nth(0).input_value() == "82.5"
        assert first_exercise.locator(".set-log-row").nth(1).locator('input:not([type="number"])').input_value() == "6"
        assert first_exercise.locator(".set-log-row").nth(1).locator('input[type="number"]').nth(1).input_value() == "9"
        assert first_exercise.locator(".set-log-row.completed").count() == 2
        assert page.get_by_placeholder("例如：睡眠不足、右膝感觉良好…").input_value() == "测试自动保存"
        page.get_by_role("button", name="完成训练并查看拉伸恢复").click()
        page.get_by_role("button", name="完成本次恢复").click()
        page.get_by_role("navigation", name="主导航").get_by_role("button", name="教练").click()
        composer = page.get_by_placeholder("输入训练感受、饮食、睡眠、体重、日期或时间安排…")
        assistant_count = page.locator(".chat-thread article.assistant").count()
        composer.fill("分析我刚才逐组完成的训练")
        page.get_by_role("button", name="发送").click()
        page.locator(".chat-thread article.assistant").nth(assistant_count).wait_for()
        latest_log = CHAT_REQUESTS[-1]["recentLogs"][0]["exercises"][0]
        completed_sets = [item for item in latest_log["setLogs"] if item["completed"]]
        assert [(item["weightKg"], item["reps"], item["rpe"]) for item in completed_sets] == [(80, "8", 7.5), (82.5, "6", 9)]

        page.screenshot(path=str(SCREENSHOT), full_page=True)
        browser.close()

    actionable = [item for item in errors if "favicon" not in item.lower()]
    if actionable:
        raise AssertionError("Browser errors:\n" + "\n".join(actionable))
    assert len(SUMMARY_REQUESTS) >= 1
    assert any(request.get("requestedDateHint") == YESTERDAY and request.get("requestedDateLogs") for request in CHAT_REQUESTS)
    assert any(
        request.get("compressedCount") == 7
        and request.get("conversationSummary")
        and len(request.get("messages", [])) == 8
        and request.get("nutrition")
        and request.get("currentSession")
        for request in CHAT_REQUESTS
    )
    print(json.dumps({"status": "passed", "screenshot": str(SCREENSHOT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
