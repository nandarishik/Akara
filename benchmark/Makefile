.PHONY: run-cafe-benchmark

# Run from benchmark/: cd benchmark && make run-cafe-benchmark
run-cafe-benchmark:
	@echo "Running café copilot evaluation..."
	@promptfoo eval \
		--config universal-smb/cafe_brewlab/promptfooconfig.yaml \
		--output universal-smb/cafe_brewlab/results/$$(date +%Y-%m-%d)_result.json
	@python check_gate.py \
		--result universal-smb/cafe_brewlab/results/$$(date +%Y-%m-%d)_result.json \
		--threshold 75
