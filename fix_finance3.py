with open("src/app/clubs/[clubId]/finance/settings/page.tsx", "r", encoding="utf-8") as f:
    s_content = f.read()

# Fix the stray </div></div> issue from earlier regex replaces
# Around line 627, 881, 1047, 1210 there are stray </div> that need removing or fixing

import re

# Instead of complex regex, let's just restore from Card back to div and do it cleaner
# It's easier to just find the broken div combinations

s_content = s_content.replace('                            </div>\n                        </div>\n                    )}\n\n                    <div className="grid md:grid-cols-2 gap-8">', '                            </div>\n                        </div>\n                    )}\n\n                    <div className="grid md:grid-cols-2 gap-8">')

with open("src/app/clubs/[clubId]/finance/settings/page.tsx", "w", encoding="utf-8") as f:
    f.write(s_content)

