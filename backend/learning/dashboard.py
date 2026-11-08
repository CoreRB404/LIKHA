"""Owner-scoped read model for the original dashboard and progress components."""
from collections import Counter
from django.db.models import Count

from .models import ActivityCompletion, Artwork, QuizAttempt, QuizDefinition
from .services import artwork_data, progress


def dashboard_data(owner):
    state = progress(owner)
    artwork_query = Artwork.objects.filter(owner=owner, status='ready')
    lab_counts = dict(artwork_query.values('lab').annotate(total=Count('pk')).values_list('lab', 'total'))
    concept_counts = Counter()
    for concepts in artwork_query.values_list('concepts', flat=True).iterator():
        for concept, value in concepts.items():
            if isinstance(value, str) and value.strip():
                concept_counts[concept] += 1
    attempts = QuizAttempt.objects.filter(owner=owner, submitted_at__isnull=False).select_related('quiz').order_by('-submitted_at')
    scores = []
    assessment_stats = {}
    category_stats = {}
    recent = []
    correct = quiz_stars = quiz_growth = 0
    identity_champion = False
    for attempt in attempts.iterator():
        total = len(attempt.questions)
        percentage = round(100 * attempt.score / total) if total else 0
        scores.append(percentage)
        correct += attempt.score
        if attempt.rewarded:
            quiz_stars += attempt.score * 10
            quiz_growth += attempt.score * 2 + 2
        identity_champion |= attempt.quiz.slug in {'week1', 'weekly-identity'} and percentage >= 80
        summary = assessment_stats.setdefault(attempt.quiz.slug, {'attempts':0, 'best':0})
        summary['attempts'] += 1
        summary['best'] = max(summary['best'], percentage)
        if len(recent) < 12:
            recent.append({'title':attempt.quiz.title, 'percentage':percentage, 'date':attempt.submitted_at.isoformat()})
        for question in attempt.questions:
            category = question.get('category', '')
            info = category_stats.setdefault(category, {'answered':0, 'correct':0, 'questions':set()})
            info['answered'] += 1
            info['questions'].add(question['id'])
            info['correct'] += (attempt.answers or {}).get(question['id']) == question['option_ids'][question['answer']]
    # Return derived counts only: never publish pending questions, answer keys,
    # student answer maps or another owner's records in the dashboard payload.
    categories = {key:{'answered':value['answered'], 'correct':value['correct'], 'explored':len(value['questions'])} for key,value in category_stats.items()}
    return {'progress':state, 'artworks':[artwork_data(art) for art in artwork_query.order_by('-created_at')[:6]],
            'lab_counts':lab_counts, 'concept_counts':dict(concept_counts),
            'activity_count':ActivityCompletion.objects.filter(owner=owner).count(),
            'assessments':[{**quiz, **assessment_stats.get(quiz['slug'], {'attempts':0, 'best':0})} for quiz in QuizDefinition.objects.order_by('slug').values('slug','title')],
            'quiz':{'count':len(scores), 'latest':scores[0] if scores else None, 'highest':max(scores) if scores else None,
                    'average':round(sum(scores)/len(scores)) if scores else None, 'correct':correct,
                    'stars':quiz_stars, 'growth_units':quiz_growth, 'recent':recent,
                    'categories':categories, 'identity_champion':identity_champion}}
