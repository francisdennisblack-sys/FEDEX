"""
Simple ML training runner.

Usage:
  python3 ml/train_model.py --input ml/data/events.jsonl --output ml/model.json

This script is a minimal example that loads event logs and trains a tiny model
to predict click probability from simple features. It requires scikit-learn.
"""
import argparse
import json
import os
import sys

def load_events(path):
    X = []
    y = []
    if not os.path.exists(path):
        print('No events file at', path); return X, y
    with open(path, 'r') as fh:
        for line in fh:
            try:
                obj = json.loads(line)
            except Exception:
                continue
            # We only use impressions and clicks where postId present
            if obj.get('postId') is None: continue
            kind = obj.get('kind')
            # Simple features: kind(impression=0,click=1), recent (ts within last day)
            now = obj.get('ts', 0)
            recent = 1 if (now and (now > ( ( __import__('time').time()*1000 ) - 24*60*60*1000 ))) else 0
            if kind == 'impression':
                X.append([0, recent])
                y.append(0)
            elif kind == 'click':
                X.append([1, recent])
                y.append(1)
    return X, y

def train(X, y, out_path, input_path=None):
    # Try scikit-learn logistic regression first; if unavailable, fall back
    # to a simple per-post CTR mapping (no deps required).
    try:
        from sklearn.linear_model import LogisticRegression
        import numpy as np
        if len(X) < 10:
            print('Not enough training rows for sklearn:', len(X)); raise ImportError('fallback')
        X_np = np.array(X)
        y_np = np.array(y)
        clf = LogisticRegression()
        clf.fit(X_np, y_np)
        model = { 'type': 'logreg', 'coef': clf.coef_.tolist(), 'intercept': clf.intercept_.tolist(), 'classes': clf.classes_.tolist() }
        with open(out_path, 'w') as fh: json.dump(model, fh)
        print('Saved sklearn model to', out_path)
        return True
    except Exception:
        # Fallback: compute clicks/impressions per post and store CTR map
        print('Falling back to CTR map trainer (no sklearn)')
        ctr = {}
        counts = {}
        # Our X,y construction encodes impression rows first, click rows later
        # But events.jsonl original file is better source; read events again
        try:
            from collections import defaultdict
            ctr_counts = defaultdict(lambda: {'impr':0,'click':0})
            with open(input_path or out_path.replace('model.json','events.jsonl'), 'r') as fh:
                for line in fh:
                    try:
                        o = json.loads(line)
                    except Exception:
                        continue
                    pid = o.get('postId')
                    if not pid: continue
                    if o.get('kind') == 'impression': ctr_counts[pid]['impr'] += 1
                    if o.get('kind') == 'click': ctr_counts[pid]['click'] += 1
            for pid, v in ctr_counts.items():
                impr = v['impr']
                clicks = v['click']
                score = clicks / (impr + 1)
                ctr[pid] = score
            model = { 'type': 'ctr_map', 'ctr': ctr }
            with open(out_path, 'w') as fh: json.dump(model, fh)
            print('Saved CTR model to', out_path)
            return True
        except Exception as e:
            print('Fallback trainer failed:', e); return False

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--input', default='ml/data/events.jsonl')
    p.add_argument('--output', default='ml/model.json')
    args = p.parse_args()
    X, y = load_events(args.input)
    train(X, y, args.output, args.input)

if __name__ == '__main__':
    main()
