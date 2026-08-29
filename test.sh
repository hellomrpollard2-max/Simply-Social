#!/bin/bash
# End-to-end test: boots the server and exercises every API surface.
cd /home/user/workspaces/737b6f2d-839d-46ef-a743-ee29ccbbf34d
node server/server.js > /tmp/pollard_test.log 2>&1 &
SRV=$!
sleep 1.5
B=http://localhost:3000/api
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  OK  $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  FAIL $1"; }
jq_email(){ python3 -c "import sys,json;print(json.load(sys.stdin)['token'])"; }

echo "== AUTH =="
T=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"email":"creator@pollard.social","password":"password123"}' | jq_email)
[ -n "$T" ] && ok "login" || bad "login"

E="u$(date +%s)@test.com"
RC=$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/auth/register -H 'Content-Type: application/json' -d "{\"email\":\"$E\",\"password\":\"x\",\"displayName\":\"U2\",\"handle\":\"u2\"}")
[ "$RC" = "201" ] && ok "register (HTTP $RC)" || bad "register (got HTTP $RC)"
RC2=$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/auth/register -H 'Content-Type: application/json' -d "{\"email\":\"$E\",\"password\":\"x\",\"displayName\":\"U2\",\"handle\":\"u2\"}")
[ "$RC2" = "409" ] && ok "register rejects duplicate email (HTTP $RC2)" || bad "duplicate email (got HTTP $RC2)"

echo "== ME =="
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/me -H "Authorization: Bearer $T")" = "200" ] && ok "me" || bad "me"
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/me)" = "401" ] && ok "me requires auth" || bad "me requires auth"

echo "== FEED/POSTS =="
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/feed -H "Authorization: Bearer $T")" = "200" ] && ok "feed" || bad "feed"
PID=$(curl -s -X POST $B/posts -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"body":"test post"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
[ -n "$PID" ] && ok "create post ($PID)" || bad "create post"
LIKE=$(curl -s -X POST $B/posts/$PID/like -H "Authorization: Bearer $T")
echo "$LIKE" | grep -q '"likes"' && ok "like returns likes count" || bad "like returns likes"
echo "$LIKE" | grep -q '"authorId"' && bad "like LEAKED full post" || ok "like does not leak post"
curl -s -X POST $B/posts/$PID/comment -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"text":"c1"}' | python3 -c "import sys,json;assert len(json.load(sys.stdin))==1" 2>/dev/null && ok "comment" || bad "comment"

echo "== GROUPS / MESSAGES / CREATOR =="
G=$(curl -s -X POST $B/groups -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"name":"TestGroup"}')
echo "$G" | grep -q '"TestGroup"' && ok "create group" || bad "create group"
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/groups -H "Authorization: Bearer $T")" = "200" ] && ok "list groups" || bad "list groups"
curl -s -X POST $B/messages -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"to":"x","text":"hello"}' > /dev/null
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/messages -H "Authorization: Bearer $T")" = "200" ] && ok "send + list messages" || bad "messages"
[ "$(curl -s -o /dev/null -w '%{http_code}' $B/creator -H "Authorization: Bearer $T")" = "200" ] && ok "creator studio" || bad "creator studio"

echo "== STATIC =="
[ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)" = "200" ] && ok "index served" || bad "index"
[ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/app.js)" = "200" ] && ok "app.js served" || bad "app.js"
[ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/style.css)" = "200" ] && ok "style.css served" || bad "style.css"

kill $SRV 2>/dev/null
echo "=============================="
echo "PASS=$PASS FAIL=$FAIL"
[ $FAIL -eq 0 ] && echo "ALL TESTS GREEN" || echo "SOME FAILURES"
exit $FAIL