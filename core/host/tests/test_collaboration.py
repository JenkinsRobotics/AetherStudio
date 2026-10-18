"""Exercise collaboration through the authenticated host, not a mock transport."""
import base64

import pytest

from core.host.server import StudioHost
from core.host.state import Problem
from core.host.tests.test_library import create, library as library_fixture

library = library_fixture


def mutation(call, file, collection, value, *, operation='add', item=None, who=0, revision=None):
    state = call('collaboration', {'id': file['id']}, who=who)
    return call('collaboration_mutate', {
        'id': file['id'], 'collection': collection, 'operation': operation,
        'item': item, 'value': value,
        'expected_revision': state['revision'] if revision is None else revision,
    }, who=who)


def test_private_permissions_and_separate_content_revision(library):
    _, _, _, _, call = library
    file = create(call)
    for action in ('collaboration', 'collaboration_mutate'):
        with pytest.raises(Problem) as exc:
            call(action, {'id': file['id']}, who=1)
        assert exc.value.status == 404
    state = mutation(call, file, 'comments', {'text': 'Review dimensions', 'revision': 1})
    assert state['comments'][0]['revision'] == 1
    assert state['revision'] == 1
    assert call('read', {'id': file['id']})['revision'] == 1
    saved = call('save', {'id': file['id'], 'expected_revision': 1,
                         'data_base64': base64.b64encode(b'new content').decode()})
    assert saved['revision'] == 2
    with pytest.raises(Problem) as exc:
        mutation(call, file, 'comments', {'text': 'stale update'}, revision=0)
    assert exc.value.status == 409
    assert len(call('collaboration', {'id': file['id']})['comments']) == 1


def test_shared_threads_permissions_and_audit(library):
    host, owner, member, _, call = library
    file = create(call, scope='workspace')
    state = mutation(call, file, 'comments', {'text': 'Member question'}, who=1)
    root = state['comments'][0]['id']
    state = mutation(call, file, 'comments', {'text': 'Owner answer', 'parent': root})
    reply = state['comments'][1]['id']
    assert len(state['members']) == 2
    with pytest.raises(Problem) as exc:
        mutation(call, file, 'comments', {'text': 'Changed answer'}, operation='update', item=reply, who=1)
    assert exc.value.status == 403
    with pytest.raises(Problem):
        mutation(call, file, 'comments', {'text': 'Nested reply', 'parent': reply})
    state = mutation(call, file, 'comments', {'resolved': True}, operation='update', item=root, who=1)
    assert state['comments'][0]['resolved']
    state = mutation(call, file, 'comments', {}, operation='delete', item=root)
    assert state['comments'][0]['deleted'] and not state['comments'][0]['text']
    assert state['comments'][1]['text'] == 'Owner answer'
    event = host.store.db.execute('SELECT before_json FROM collaboration_events WHERE file_id=? AND operation=?', (file['id'], 'delete')).fetchone()
    assert 'Member question' in event['before_json']


def test_tasks_assignment_due_dates_notes_and_restart(library):
    host, _, member, tokens, call = library
    file = create(call, scope='workspace')
    state = mutation(call, file, 'tasks', {'text': 'Check harness', 'assignee': member, 'due': '2026-10-10'})
    task = state['tasks'][0]['id']
    state = mutation(call, file, 'tasks', {'status': 'done'}, operation='update', item=task, who=1)
    assert state['tasks'][0]['status'] == 'done'
    with pytest.raises(Problem) as exc:
        mutation(call, file, 'tasks', {'text': 'Replace task'}, operation='update', item=task, who=1)
    assert exc.value.status == 403
    for value in ({'due': '2026-02-30'}, {'assignee': 'unknown'}, {'status': 'invalid'}):
        with pytest.raises(Problem):
            mutation(call, file, 'tasks', value, operation='update', item=task)
    mutation(call, file, 'notes', {'text': 'Build specification'}, operation='update')
    with pytest.raises(Problem) as exc:
        mutation(call, file, 'notes', {'text': 'overwrite'}, operation='update', who=1)
    assert exc.value.status == 403
    mutation(call, file, 'reminders', {'text': 'Review before release', 'due': '2026-10-20'})
    # Opening a second host against the persisted installation exercises schema upgrade too.
    reopened = StudioHost(host.store.directory)
    restored = reopened.dispatch('/api/library/collaboration', {'app': 'cad', 'id': file['id']}, tokens[0], 'local')
    assert restored['notes']['text'] == 'Build specification'
    assert restored['tasks'][0]['status'] == 'done'
    assert restored['reminders'][0]['due'] == '2026-10-20'
    assert len(restored['activity']) == 4


def test_comment_workspace_reference_images_and_replies_persist(library):
    _, _, _, _, call = library
    file = create(call)
    call('branch_create', {'id': file['id'], 'name': 'Prototype', 'expected_revision': 1})
    call('version', {'id': file['id'], 'name': 'Review', 'expected_revision': 1})
    image = {'name': 'Review.png', 'data_url': 'data:image/png;base64,' + base64.b64encode(b'\x89PNG\r\n\x1a\n' + b'image').decode()}
    state = mutation(call, file, 'comments', {'text': 'Check this', 'branch': 'Prototype', 'revision': 1, 'attachments': [image]})
    root = state['comments'][0]
    assert root['branch'] == 'Prototype' and root['reference_name'] == 'Review'
    assert root['attachments'] == [image]
    state = mutation(call, file, 'comments', {'text': 'Reply from Main', 'branch': 'Main', 'parent': root['id']})
    assert state['comments'][1]['branch'] == 'Prototype'
    mutation(call, file, 'comments', {'text': 'Edited', 'revision': None, 'attachments': []}, operation='update', item=root['id'])
    persisted = call('collaboration', {'id': file['id']})['comments'][0]
    assert persisted['attachments'] == [] and persisted['revision'] is None
    assert call('read', {'id': file['id']})['revision'] == 1


@pytest.mark.parametrize('value', [
    {'branch': 'missing'}, {'revision': []}, {'revision': True}, {'revision': 999},
    {'attachments': [{}]}, {'attachments': [{'name': 'code.svg', 'data_url': 'data:image/svg+xml;base64,PHN2Zy8+'}]},
    {'attachments': [{'name': 'image.png', 'data_url': 'data:image/png;base64,SGVsbG8='}]},
    {'attachments': [1, 2, 3, 4]},
])
def test_comment_metadata_validation_is_atomic(library, value):
    _, _, _, _, call = library
    file = create(call)
    with pytest.raises(Problem) as error:
        mutation(call, file, 'comments', {'text': 'Invalid attachment', **value})
    assert error.value.status == 400
    assert call('collaboration', {'id': file['id']})['comments'] == []
