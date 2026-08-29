import json, time
now = int(time.time() * 1000); d = 86400000
p = 'data/store.json'; s = json.load(open(p))

def only_seed(items, seed_ids):
    return [x for x in items if x['id'] in seed_ids]

seed_users = ['u_daniel_pollard', 'u_ava', 'u_marcus']
seed_posts = ['p1', 'p2', 'p3', 'p4']
seed_msgs = ['m1', 'm2']
seed_groups = ['g1']
seed_auctions = ['a1', 'a2', 'a3']
seed_jobs = ['j1', 'j2', 'j3']
seed_checkins = ['w1']

s['users'] = [u for u in s['users'] if u['email'] in ('creator@pollard.social', 'ava@example.com', 'marcus@example.com')]
s['posts'] = [x for x in s['posts'] if x['id'] in seed_posts]
s['messages'] = [x for x in s['messages'] if x['id'] in seed_msgs]
s['groups'] = [x for x in s['groups'] if x['id'] in seed_groups]
s['auctions'] = [x for x in s['auctions'] if x['id'] in seed_auctions]
s['jobs'] = [x for x in s['jobs'] if x['id'] in seed_jobs]
s['wellness'] = {
    'checkIns': [x for x in s['wellness']['checkIns'] if x['id'] in seed_checkins],
    'resources': s['wellness']['resources'],
}
s['sessionTokens'] = {}

# restore seed prices/state
for a in s['auctions']:
    a['currentBid'], a['bidCount'], a['bids'] = {
        'a1': (30500, 14, [{'bidder': 'u_marcus', 'amount': 30500, 'at': now - 3600000}]),
        'a2': (31000, 0, []),
        'a3': (6700, 3, [{'bidder': 'u_daniel_pollard', 'amount': 6700, 'at': now - 7200000}]),
    }[a['id']]
for j in s['jobs']:
    j['applications'] = []

json.dump(s, open(p, 'w'), indent=2)
print('users:', len(s['users']), '| posts:', len(s['posts']), '| auctions:', len(s['auctions']),
      '| jobs:', len(s['jobs']), '| checkins:', len(s['wellness']['checkIns']), '| tokens:', len(s['sessionTokens']))