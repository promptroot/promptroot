from playwright.sync_api import sync_playwright

def verify_app_load():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        try:
            page.goto("http://localhost:3000")
            page.wait_for_load_state("networkidle")

            # Check for console errors
            if console_errors:
                print("Console errors found:")
                for error in console_errors:
                    print(f"- {error}")
            else:
                print("No console errors found.")

            page.screenshot(path="verification/app_load.png")
            print("Screenshot saved to verification/app_load.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_app_load()
