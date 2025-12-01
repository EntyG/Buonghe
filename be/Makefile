start-backend-server:
	python server.py

start-redis:
	docker run -d --name redis -p 6379:6379 -e REDIS_PASSWORD=redispass redis:latest

stop-redis:
	docker stop redis
	docker rm redis

start-image-server:
	docker run -d -v /home/aic/storage/aic2025:/app/data --name image-server -p 8081:8080 image_server:latest

stop-image-server:
	docker stop image-server
	docker rm image-server

start-frontend:
	docker run -d --name visionary-frontend -p 8080:20850 visionary_frontend:latest

stop-frontend:
	docker stop visionary-frontend
	docker rm visionary-frontend


es:
	@docker pull docker.elastic.co/elasticsearch/elasticsearch:8.7.0
	@-docker run -d --name es-visionary --net milvus -p 9200:9200 -it --memory=4g --cpus=1 -e "discovery.type=single-node" -e "xpack.security.enabled=true" -e "xpack.security.http.ssl.enabled=false" -e "xpack.security.transport.ssl.enabled=false" -e "ELASTIC_PASSWORD=mNkPQAftbVQ9xpNf0sqe" -e "ES_JAVA_OPTS=-Xms2g -Xmx2g" docker.elastic.co/elasticsearch/elasticsearch:8.7.0
	@echo "Elasticsearch is starting up with security enabled..."
	@echo "Access it at: http://localhost:9200"
	@echo "Username: elastic"
	@echo "Password: mNkPQAftbVQ9xpNf0sqe"
	@echo ""
	@echo "Test with: curl -u elastic:mNkPQAftbVQ9xpNf0sqe http://localhost:9200/_cluster/health?pretty"

es-dev:
	@docker pull docker.elastic.co/elasticsearch/elasticsearch:8.7.0
	@-docker run -d --name es-visionary --net milvus -p 9200:9200 -it --memory=4g --cpus=1 -e "discovery.type=single-node" -e "xpack.security.enabled=false" -e "xpack.security.http.ssl.enabled=false" -e "ES_JAVA_OPTS=-Xms2g -Xmx2g" docker.elastic.co/elasticsearch/elasticsearch:8.7.0
	@echo "Elasticsearch is starting up..."
	@echo "Access it at: http://localhost:9200"
	@echo "No authentication required (security disabled for development)"

start-es:
	@docker start es-visionary

stop-es:
	@docker stop es-visionary
	@docker rm es-visionary

restart-es:
	make stop-es && make start-es

logs-es:
	@docker logs es-visionary -f