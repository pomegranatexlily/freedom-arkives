#!/usr/bin/env python3
"""Add the author's screenshot-confirmed fourteenth book, once."""
import json
import re
from pathlib import Path

ENTRY = {'id': 'brownie-mcqueen-brownie-wars', 'title': 'Brownie McQueen and the Brownie Wars: A Story and Coloring Adventure About Big Dreams, Business, and Believing in Yourself', 'author': 'Nachamasha Yahsharala', 'series': 'Brownie McQueen', 'order': 14, 'readingRole': 'Explore big dreams, business, and self-belief', 'description': 'A story and coloring adventure about big dreams, business, and believing in yourself.', 'subjects': ['Children’s Books', 'Coloring', 'Business', 'Self-Belief'], 'editions': [{'format': 'Amazon listing', 'price': '$14.00', 'asin': 'B0HN63YKVG', 'url': 'https://www.amazon.com/dp/B0HN63YKVG'}]}
COVER = "data:image/avif;base64," + 'AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAAMQbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAM4AAAOQgAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAAKPaXBycAAAAm9pcGNvAAAAFGlzcGUAAAAAAAAAwAAAAMAAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAACJGNvbHJwcm9mAAACGGFwcGwEAAAAbW50clJHQiBYWVogB+YAAQABAAAAAAAAYWNzcEFQUEwAAAAAQVBQTAAAAAAAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1hcHBsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKZGVzYwAAAPwAAAAwY3BydAAAASwAAABQd3RwdAAAAXwAAAAUclhZWgAAAZAAAAAUZ1hZWgAAAaQAAAAUYlhZWgAAAbgAAAAUclRSQwAAAcwAAAAgY2hhZAAAAewAAAAsYlRSQwAAAcwAAAAgZ1RSQwAAAcwAAAAgbWx1YwAAAAAAAAABAAAADGVuVVMAAAAUAAAAHABEAGkAcwBwAGwAYQB5ACAAUAAzbWx1YwAAAAAAAAABAAAADGVuVVMAAAA0AAAAHABDAG8AcAB5AHIAaQBnAGgAdAAgAEEAcABwAGwAZQAgAEkAbgBjAC4ALAAgADIAMAAyADJYWVogAAAAAAAA9tUAAQAAAADTLFhZWiAAAAAAAACD3wAAPb////+7WFlaIAAAAAAAAEq/AACxNwAACrlYWVogAAAAAAAAKDgAABELAADIuXBhcmEAAAAAAAMAAAACZmYAAPKnAAANWQAAE9AAAApbc2YzMgAAAAAAAQxCAAAF3v//8yYAAAeTAAD9kP//+6L///2jAAAD3AAAwG4AAAATY29scm5jbHgAAgACAAaAAAAAGGlwbWEAAAAAAAAAAQABBQECgwQFAAAOSm1kYXQSAAoKGB3v79ogQEDQgDKxHBMB4eF3I444xYqBANtICTtakM6TALnVkF7vjE2VHiZHEIZQwKlyKR+zZaUr2vV/3nhFQFUClq0Rx1p/ZsdmfjDK/uWPbL33O0lSw0UyTTk7MwZn2QvpOzO2eeInFjiSnmPseS72UAnCqFxQFD/xOyJbx4r//r5rxvw7pJ/IpuWbiE86VZuWnnBqhGIKTEllGySczkvDNA4TOmnTZvgldeomGwfCjDC/iz/DwcqjzVXUmy9M0Z5gALtrMrX3f4GdbQF31kNsf6FTAwML9C5JuwxuwPhq16qFMzDszKg8LH4AE3DEGQY5ctkQwWk5ozfdwDT+1yzTl24T9PemdxqKVm3hRdcAQp4P6vndNU0xwJDJYhPT9kxBfJWEwZ+kemIle6JpfAFQDD4gKHx0goHXAS1FgHjJXT8Vz6ldn9RA/PZ1HeZ5QJ6ABAe2dPMJHtbns8SJzAMmNpH1QzDDQ+Hyk0nhZjAFns5eUH5lWzoGbtOZxIhlOhCI577m6P3zPwZLDnrldXKJOZqEZ5eG2LfioLO2VW5id0JAdLsP0IaqHkRhRDtSO5m3ng1CQUQ4WgBbPRfAdoF1r4GaMdoK5v/bzN1XX0qscwd3DIz7vdthZf4BLQN8XC62qc7NEjplgeybmjECQpmrBJvc4gIiw6jeZyyWoNIimkI1BIjoJ0g+ALwx3+WeIdyMSBWKA5uYrWvsMUBatCvRPHepxVheO2Gp5t92RF8R81JwOHggHuSCeZziMyRqrTeaLgipsivnV+tjoPPv60utIJx199nID8Pf0moOTxy0l9yQby+2eDbGzAMl7+t8tlkBPiLsgFi7zAi5Ph3rrog9Ea5LBYmEPFlzHnoq+rfCJRVsuxCacwkZfzKAz1POsa/8gjc752dlz0HX3eQ2LXffUeuCYuOLFLA/+yk6zt1+6zB9cHG8nEDGgraE320ZK0UGPULugH8MXy1zwtA1bCbiZCbWLpL5lqjmV6SoFvqLa6Bx16QkLt9x/lfdtogQSH+LTj9FeqlFdWhCETuu93OxD9Dj6pwckwWUPo3AoJJzEjOJ0FOvktPRhEBQLLjt79N2qPN4oZuv331aN7H4By8TowPIdpqDv6Qgc3gZ4FOkDIXX6cbOfzkmrdUX3fhljc6GSDl+1C+CuFDIEWzLY5d3QoBCjkH8gud+GRYPZgLXuU4Z7q8BLiSZUcvnrloOkMdHOHvPwIJA//ORXfrL+gFvKMpYT8GkyiLRDslDUhVGb3HubqT4eNuu4moMCSPQyW89V3QjJtb/bLJs2mJu7rpA6gctRL3qTZBRmBzT0uD7P6wT+tJ4ERMYvy3x7piRqiR3jFEjYUXCM7M6SuxUafLXQGsPmNWP+qBvfOmso+NT9I/aHQXks1BTY9tvpJB9MEcLwgszhTKqw5b47yz8gTfwws2p8l02m3ZHidUtY3+CVQPe7UFsGVCjKpKftyh4+1A7don1zgWrWTFTQ+6dwrdEsAxJVgv8qMhtc3uaVk1xtczWXBQxjuSjaLmUls3yl8XjuMa0Nk2SlHqfX4QuikZDwtGGLvR2BmeJkVs4zyE0vo+/3nPKK3CbGEPtvwlVT8JdQqSGX62mSma8tQZgTzsvl51caIIbtB51m7qhz3eArQ0O+D5JDRRoM7ejyIAwfiNUuR+xiw1OxGN7T8Yk9LsEB55NyjstA3Zl9b1G/wOWSa4kctLJR4JNuby1lC2CLyNHBs8IYOkmuZXrDzA5STycqFP1wcyZEhzHx7xGkMgtCFnyd+PzppgZnNEBwh37lULHzwxTPz0fz9EEqSwbTkwdygiL/nIIGMguAJKFdA+6j9sJ299PoZI4NdDK+mrhItgnn0Fl4JPEO133JebuliQjK2TELJmQL37D/ENASPSSkAEYDDHyEMXrD5aVNEDhC33sTpFtQ1O9weXeYUNJbP0hjXnURb9UKbLqLfH7UAbD26DfcEYhqDAGQ/C0E+R2weJHU1VM9+DgHTAAtTVooNXh/5g//mxmU5NJAVSyAwx6UVS0G5IC2/+bV91kFkmLoJblrqxtI1pgOyuo3OcsHBE61xcog5pwFK66kyi+6YGI0GSULGYn/rgQCUy+i/FLVS9gC7ApKq+tKrCp0kISqq4h7pZkACLY8S2vGJAIuzcluYlpYAy1JCHpbufMgdk114SKt61Kq4jXf7z83LwOmII9i+w0R7NS7hMMEAGqRuMmFtJS74KnYL8c3HmpQ+epxOADJyak8jDnpYlQazLcyTkzXC6uT23RGj20lk5d9BNP+DliQCjLo7dlN/bx1NuEuL526vgnD3EE0UycWFKqDMlVFOMMP4D5kGnvva/9x5O4op0nBtR9KXT43yqIjdMbudC0oJdEdrpWVFKjPXbfLCQtB8bPF532SLSrjpbqf2G1RskcA0+i8Z00FgCmvzdPx/BgjVK/A1WvpxN2GD51QsJeFkhqQlQkpOPHzVtiK+wkW+GNTbgx570BytjjOEirvZQcA2D3gYjnop2+wDBopOiIk9r/2/UCdz8VzAY6ZHunvkXhV98iX0yXhUWzcukCFX+luDtNp6A71rLTi9klabwdPSJfnc+l0+CZxZSwOXnZR/33fGZVYpd+ry5X02XFvNCnsutFGl6T8d61gSzuTsGwB77JTFcHZnT7ofPsoBySAe1iXpHKFlybFbA5F6Cz3XuwRZEU+6O5wcuzlbnkLmJtWIHN52nF02bRJajbIgfQvPLiOpUoHUjOTg7BdXurGkpQR6o4RLF9fR78a+GpVkt+f8fCAofqdXzRjjhwpGtAAZUWjTPOuaapPU6XZ+knH8MkQT5vjmEQKLAQXhGghDPg/fVOytO1JYjYbUGCTHXFI2QR0qa7Gg/W7zzXZeoscKaufEJBIx2BdK+UM0pBPb7/iX6G0rg+VQ2k57p1fAiMDlsBtCK1q0nqt4YtRmaRiF6LK4jHrLcg2+4pPg37eHeJyJ7/R8FmKQPJK2oizUZV1fzkg1++vmyRMIljKBc3CGz5GTR5muQdOq2KX3LdO58HliDXTqPBxfg2bkR9+n5F5LOS8+MhAoWO1GyqMQvRVM70Xo0PjY17C1Pq0cimuwCzbWLUpzXnUd/URGrg6GDiVP04sPFkkzv2U/4QWYmEnJfuqSJnZ7ZVNzAyAdiGFU7rG4Uh/6Spy4eKq9P/zyTbIFz0gMER+Z1nRTK4bjYB5+NRMM1se/wPxAlsfBvoG4BaMXQLN66YhlyTR0T/ii2GM6TTvqkPNdf5PaXc5v3iJW0Xsx4T5FGqIOyDPB28iadyKEMbuVvqDFVC8hc16VY3456XifSm+m3ex/TR0myRssQSeOnz44IX6BIbMcWjGlGxAQr91Z6G2EQ3SgcPLUO27PUzXilqAs/kPJ/r3OZEH4zPcS8z3VGt7EZhO5wQg8UNSJ+Ui0Wh24M0jOSjTcrwwzHYdRQwCSq5hVb6yjTTBZv63XH23X+N0ny5jVfrLnkKcQC5Fo6i069b9JW0spz8MGQ5064e7IcvR+nMJUBWZJn2y0WnXoD+nEFsW98gd4JIhWfCrliyVXr7WJclJUiNiKsoZcSSBYJ913UghrXnx+Qa76mN0h7cy1Ng4leaR3hrs+ccSGChaeDEg9ZtbFi/TAjfJto/F/qNkbOUeX/mbRruFXLJNs2JvWi+Zl9zOCTWNJwXpDyZeJkWI132XMfqxWc31xMrnA+UYKwvSEXL5tQSd65kyA3EXVbK1FzKkpfOgfGZd8aa4aBmw0bNSGHFwoC9LUBpbofa9OSqvv13W8fpQY6oSp9/JHPI7VGmd8giJ84T0pYNjfNQXivB7sfdYGHZ6C+MpdJ0tMO9gn7p6xYF0lkphn4RQi+c2zvxAtVzoX+Fi1kYgcLfah1a7tP0BD/sbwzM9HjxE9qJ3FnLg+X12Q7/aNv9M/3NVQqrk+JzKrsntAzj3TKPMMSiQpD3tM7+KzBkAvpj3UUPhIAJQJauZMC8aQR53sr51vZvQpulTreytg1HPyYF5wG1HgHEB0SovHNG1x35C3U5OmplkApY32SdtL2aj2h000YHqGkqFpQ4V68j6SJNHfc7IoPbi4ekpJQHbWGz0emPW99PY9BRO9oA1BffuWAZte8qIZDCHXaaPVYidNt8vc1E/xhNRQBbPXXf8IvQs5jX2ChOQVOP0BhtW0fxRk4wOjNckwnzHGZ60b6Egny0lxdB1clWNnEEF0H49vRVmhKHTjakR+S2PMkndFZMNJqkjLea0LVKJlEc1dEQSh/psqdzup18MNhJBLIqEFPSO9g0c7yoaEnVCNLfHqQQZE1CvO1hFz0O/ZXdYJLFIB57HjEC++jfTsG+fQUL6g7/Hjk4MMTktVFRv3dKgHCszq9w7y4KuZlQvU7Qvnra+th1kBAbIRTmTVN0j+6EhdLCwsnippqHa010pgmaUNBpGDeoA4gJYyd13BEHM8z0iTuKegtl6qY+2wl0s77JoHpRJQFy90YJaLnTCv8Qz/VntGndZGGYBU1Ncvq4pvaXjzzTlWoDgOVWoMCJ8kvYWr4X93MtLWKoxoSTsZQT8xGFOY84nkKMP6zh/bPMjmiWsTnp7e5tIZB+pPWWla5Lpfpb5y0u8ET3oUOyuPSvqbBiT2+6PnXFYtCfdsIeoQ50YngHOToVV49Ry84mJHzSEMdAPCJ015vNU1bcBed2UIC9faL5tnlX/oX1Nh+exhkssVILtg7BGJjP7gh+4BbLrhBaJ+FN/ceXrInd2qwCxG1YYJ2jXQcmGNkhMx47PiVsX5RqBle7GXPpS7aNNeBLlIb12/QPzhxSzJ/jUA6YnNEysBIwO6BstYlxqp+7R9oC9kmEqW7RF2eVmzeFP3t43rSFzj7n4A=='

def add_book(root):
    page = Path(root) / "index.html"
    text = page.read_text(encoding="utf-8")
    match = re.search(r'(<script type="application/json" id="catalogData">)(.*?)(</script>)', text, re.S)
    if not match:
        raise ValueError("Missing catalogData; no changes made")
    catalog = json.loads(match.group(2))
    books = catalog["books"]
    matches = [b for b in books if b.get("id") == ENTRY["id"] or any(e.get("asin") == "B0HN63YKVG" for e in b.get("editions", []))]
    if matches:
        if len(matches) != 1 or matches[0]["title"] != ENTRY["title"]:
            raise ValueError("Conflicting existing book; no changes made")
        return len(books)
    if len(books) != 13:
        raise ValueError("Expected 13 existing books; no changes made")
    original_books = json.loads(json.dumps(books))
    entry = json.loads(json.dumps(ENTRY))
    entry["cover"] = COVER
    books.append(entry)
    raw_catalog = match.group(2)
    array_match = re.search(r'"books"\s*:\s*(\[)', raw_catalog)
    if not array_match:
        raise ValueError("Missing books array; no changes made")
    start = array_match.start(1)
    old_books, consumed = json.JSONDecoder().raw_decode(raw_catalog[start:])
    if old_books != original_books:
        raise ValueError("Unexpected books array; no changes made")
    inner = raw_catalog[start + 1:start + consumed - 1]
    content = inner.rstrip()
    trailing = inner[len(content):]
    entry_text = "\n".join("      " + line for line in json.dumps(entry, ensure_ascii=False, indent=6).splitlines())
    new_array = "[" + content + ",\n" + entry_text + trailing + "]"
    payload = raw_catalog[:start] + new_array + raw_catalog[start + consumed:]
    updated = text[:match.start(2)] + payload + text[match.end(2):]
    check = re.search(r'(<script type="application/json" id="catalogData">)(.*?)(</script>)', updated, re.S)
    restored = json.loads(check.group(2))
    original = json.loads(match.group(2))
    if len(restored["books"]) != 14 or restored["books"][:-1] != original["books"] or restored.get("articles") != original.get("articles"):
        raise ValueError("Catalog preservation check failed; no changes made")
    if updated[:match.start(2)] != text[:match.start(2)] or updated[check.end(2):] != text[match.end(2):]:
        raise ValueError("Non-catalog markup changed; no changes made")
    page.write_text(updated, encoding="utf-8")
    return len(books)

if __name__ == "__main__":
    print("Verified catalog book count:", add_book(Path.cwd()))
